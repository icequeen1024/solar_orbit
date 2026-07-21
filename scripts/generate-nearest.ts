import { writeFile } from "node:fs/promises";
import {
  DAY_MS,
  J2000_MS,
  MODEL_METADATA,
  PLANET_IDS,
  RANGE_END_MS,
  RANGE_START_MS,
  nearestPlanetFromPositions,
  planetPositionAtDays,
  type PlanetId,
} from "../lib/astronomy.ts";

const SIX_HOURS_MS = 6 * 60 * 60 * 1_000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1_000;
const ONE_MINUTE_MS = 60 * 1_000;

type Durations = Record<PlanetId, Record<PlanetId, number>>;
type Timelines = Record<PlanetId, Array<[number, PlanetId]>>;

function emptyDurations(): Durations {
  return Object.fromEntries(
    PLANET_IDS.map((selected) => [
      selected,
      Object.fromEntries(PLANET_IDS.map((candidate) => [candidate, 0])),
    ]),
  ) as Durations;
}

function positionsAt(dateMs: number) {
  const days = (dateMs - J2000_MS) / DAY_MS;
  return PLANET_IDS.map((id) => planetPositionAtDays(id, days));
}

function nearestIdsAt(dateMs: number) {
  const positions = positionsAt(dateMs);
  return Object.fromEntries(
    PLANET_IDS.map((selected) => [
      selected,
      nearestPlanetFromPositions(selected, positions).planet.id,
    ]),
  ) as Record<PlanetId, PlanetId>;
}

function nearestIdForPlanet(selected: PlanetId, dateMs: number) {
  return nearestPlanetFromPositions(selected, positionsAt(dateMs)).planet.id;
}

function refineTransition(
  selected: PlanetId,
  fromMs: number,
  toMs: number,
  startingNearest: PlanetId,
) {
  let low = fromMs;
  let high = toMs;
  while (high - low > ONE_MINUTE_MS) {
    const middle = low + (high - low) / 2;
    if (nearestIdForPlanet(selected, middle) === startingNearest) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function calculate(stepMs: number) {
  const durations = emptyDurations();
  let previousTime = RANGE_START_MS;
  let previousNearest = nearestIdsAt(previousTime);
  const timelines = Object.fromEntries(
    PLANET_IDS.map((selected) => [selected, [[0, previousNearest[selected]]]]),
  ) as Timelines;
  let samples = 1;
  let transitions = 0;

  for (
    let currentTime = RANGE_START_MS + stepMs;
    currentTime <= RANGE_END_MS;
    currentTime += stepMs
  ) {
    const boundedTime = Math.min(currentTime, RANGE_END_MS);
    const currentNearest = nearestIdsAt(boundedTime);

    for (const selected of PLANET_IDS) {
      const before = previousNearest[selected];
      const after = currentNearest[selected];
      if (before === after) {
        durations[selected][before] += boundedTime - previousTime;
      } else {
        const transition = refineTransition(
          selected,
          previousTime,
          boundedTime,
          before,
        );
        durations[selected][before] += transition - previousTime;
        durations[selected][after] += boundedTime - transition;
        timelines[selected].push([
          Math.round((transition - RANGE_START_MS) / ONE_MINUTE_MS),
          after,
        ]);
        transitions += 1;
      }
    }

    previousTime = boundedTime;
    previousNearest = currentNearest;
    samples += 1;
    if (boundedTime === RANGE_END_MS) break;
  }

  return { durations, timelines, samples, transitions };
}

function roundForDisplay(
  durations: Record<PlanetId, number>,
  totalDuration: number,
) {
  const nonzero = PLANET_IDS.filter((id) => durations[id] > 0).map((id) => {
    const exactTenths = (durations[id] / totalDuration) * 1_000;
    return {
      id,
      floorTenths: Math.floor(exactTenths),
      remainder: exactTenths - Math.floor(exactTenths),
    };
  });
  let remainingTenths =
    1_000 - nonzero.reduce((sum, entry) => sum + entry.floorTenths, 0);
  const ranked = [...nonzero].sort(
    (a, b) =>
      b.remainder - a.remainder ||
      PLANET_IDS.indexOf(a.id) - PLANET_IDS.indexOf(b.id),
  );
  for (const entry of ranked) {
    if (remainingTenths <= 0) break;
    entry.floorTenths += 1;
    remainingTenths -= 1;
  }
  return nonzero
    .map((entry) => ({ id: entry.id, percentage: entry.floorTenths / 10 }))
    .sort(
      (a, b) =>
        b.percentage - a.percentage ||
        PLANET_IDS.indexOf(a.id) - PLANET_IDS.indexOf(b.id),
    );
}

const result = calculate(SIX_HOURS_MS);
const totalDuration = RANGE_END_MS - RANGE_START_MS;
const percentages = Object.fromEntries(
  PLANET_IDS.map((selected) => [
    selected,
    roundForDisplay(result.durations[selected], totalDuration),
  ]),
) as Record<PlanetId, PercentageEntry[]>;

type PercentageEntry = { id: PlanetId; percentage: number };
let convergence:
  | {
      comparisonSampleHours: number;
      maximumDisplayedDifference: number;
      passed: boolean;
    }
  | undefined;

if (process.argv.includes("--converge")) {
  const finerResult = calculate(THREE_HOURS_MS);
  const finerPercentages = Object.fromEntries(
    PLANET_IDS.map((selected) => [
      selected,
      roundForDisplay(finerResult.durations[selected], totalDuration),
    ]),
  ) as Record<PlanetId, PercentageEntry[]>;
  let maximumDisplayedDifference = 0;
  for (const selected of PLANET_IDS) {
    const coarse = new Map(
      percentages[selected].map((entry) => [entry.id, entry.percentage]),
    );
    const fine = new Map(
      finerPercentages[selected].map((entry) => [entry.id, entry.percentage]),
    );
    for (const candidate of PLANET_IDS) {
      maximumDisplayedDifference = Math.max(
        maximumDisplayedDifference,
        Math.abs((coarse.get(candidate) ?? 0) - (fine.get(candidate) ?? 0)),
      );
    }
  }
  convergence = {
    comparisonSampleHours: 3,
    maximumDisplayedDifference,
    passed: maximumDisplayedDifference <= 0.1 + Number.EPSILON,
  };
  if (!convergence.passed) {
    throw new Error(
      `Convergence failed: maximum displayed difference was ${maximumDisplayedDifference.toFixed(1)} percentage points.`,
    );
  }
}

const output = {
  model: MODEL_METADATA,
  interval: {
    start: new Date(RANGE_START_MS).toISOString(),
    endExclusive: new Date(RANGE_END_MS).toISOString(),
  },
  method: {
    sampleHours: 6,
    transitionToleranceMinutes: 1,
    samples: result.samples,
    detectedTransitions: result.transitions,
    rounding: "largest remainder to one decimal place",
    timelineEncoding:
      "Each [minute offset, planet] starts a nearest-neighbor run measured from the interval start.",
    ...(convergence ? { convergence } : {}),
  },
  percentages,
  timelines: result.timelines,
};

await writeFile(
  new URL("../data/nearest-percentages.json", import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(
  `Generated ${result.samples.toLocaleString()} samples and refined ${result.transitions.toLocaleString()} transitions.${convergence ? ` Convergence passed at ${convergence.maximumDisplayedDifference.toFixed(1)} percentage points.` : ""}`,
);
