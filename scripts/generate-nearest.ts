import { writeFile } from "node:fs/promises";
import {
  DAY_MS,
  J2000_MS,
  MODEL_METADATA,
  PLANET_IDS,
  RANGE_END_MS,
  RANGE_START_MS,
  planetPositionAtDays,
  type PlanetId,
} from "../lib/astronomy.ts";
import { encodePlanetOrder } from "../lib/nearest-statistics.ts";

const SIX_HOURS_MS = 6 * 60 * 60 * 1_000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1_000;
const ONE_MINUTE_MS = 60 * 1_000;

type Durations = Record<PlanetId, Record<PlanetId, number>>;
type MutableRankedTimelines = Record<PlanetId, Array<[number, number]>>;

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

function sameOrder(a: readonly PlanetId[], b: readonly PlanetId[]) {
  return a.every((id, index) => id === b[index]);
}

function rankedIdsFromPositions(
  selected: PlanetId,
  positions: ReturnType<typeof positionsAt>,
) {
  const selectedPosition = positions.find((position) => position.id === selected);
  if (!selectedPosition) throw new Error(`Missing position for ${selected}.`);
  return positions
    .filter((position) => position.id !== selected)
    .map((position) => {
      const dx = selectedPosition.x - position.x;
      const dy = selectedPosition.y - position.y;
      const dz = selectedPosition.z - position.z;
      return { id: position.id, distanceSquared: dx * dx + dy * dy + dz * dz };
    })
    .sort(
      (a, b) =>
        a.distanceSquared - b.distanceSquared ||
        PLANET_IDS.indexOf(a.id) - PLANET_IDS.indexOf(b.id),
    )
    .map((entry) => entry.id);
}

function rankedIdsAt(dateMs: number) {
  const positions = positionsAt(dateMs);
  return Object.fromEntries(
    PLANET_IDS.map((selected) => [
      selected,
      rankedIdsFromPositions(selected, positions),
    ]),
  ) as Record<PlanetId, PlanetId[]>;
}

function rankedIdsForPlanet(selected: PlanetId, dateMs: number) {
  return rankedIdsFromPositions(selected, positionsAt(dateMs));
}

function refineRankingTransition(
  selected: PlanetId,
  fromMs: number,
  toMs: number,
  startingOrder: readonly PlanetId[],
) {
  let low = fromMs;
  let high = toMs;
  let highOrder = rankedIdsForPlanet(selected, high);
  while (high - low > ONE_MINUTE_MS) {
    const middle = low + (high - low) / 2;
    const middleOrder = rankedIdsForPlanet(selected, middle);
    if (sameOrder(middleOrder, startingOrder)) low = middle;
    else {
      high = middle;
      highOrder = middleOrder;
    }
  }
  return { timeMs: high, order: highOrder };
}

function appendRankingTransition(
  timeline: Array<[number, number]>,
  timeMs: number,
  order: readonly PlanetId[],
) {
  const offsetMinutes = Math.round((timeMs - RANGE_START_MS) / ONE_MINUTE_MS);
  const orderCode = encodePlanetOrder(order);
  const previous = timeline.at(-1);
  if (previous?.[0] === offsetMinutes) previous[1] = orderCode;
  else timeline.push([offsetMinutes, orderCode]);
}

function calculate(stepMs: number) {
  const durations = emptyDurations();
  let previousTime = RANGE_START_MS;
  let previousRankings = rankedIdsAt(previousTime);
  const rankings = Object.fromEntries(
    PLANET_IDS.map((selected) => [
      selected,
      [[0, encodePlanetOrder(previousRankings[selected])]],
    ]),
  ) as unknown as MutableRankedTimelines;
  let samples = 1;
  let rankingTransitions = 0;

  for (
    let currentTime = RANGE_START_MS + stepMs;
    currentTime <= RANGE_END_MS;
    currentTime += stepMs
  ) {
    const boundedTime = Math.min(currentTime, RANGE_END_MS);
    const currentRankings = rankedIdsAt(boundedTime);

    for (const selected of PLANET_IDS) {
      let segmentStart = previousTime;
      let segmentOrder = previousRankings[selected];
      const finalOrder = currentRankings[selected];
      let transitionsInSample = 0;

      while (!sameOrder(segmentOrder, finalOrder)) {
        const transition = refineRankingTransition(
          selected,
          segmentStart,
          boundedTime,
          segmentOrder,
        );
        durations[selected][segmentOrder[0]] += transition.timeMs - segmentStart;
        appendRankingTransition(
          rankings[selected],
          transition.timeMs,
          transition.order,
        );
        rankingTransitions += 1;
        segmentStart = transition.timeMs;
        segmentOrder = transition.order;
        transitionsInSample += 1;
        if (transitionsInSample > 8) {
          throw new Error(`Too many ${selected} ranking changes in one sample.`);
        }
      }
      durations[selected][segmentOrder[0]] += boundedTime - segmentStart;
    }

    previousTime = boundedTime;
    previousRankings = currentRankings;
    samples += 1;
    if (boundedTime === RANGE_END_MS) break;
  }

  return { durations, rankings, samples, rankingTransitions };
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
    detectedRankingTransitions: result.rankingTransitions,
    rounding: "largest remainder to one decimal place",
    rankingEncoding:
      "Each [minute offset, order code] starts a complete nearest-to-farthest candidate ordering. The code packs seven Mercury-to-Neptune indices into three bits each.",
    ...(convergence ? { convergence } : {}),
  },
  percentages,
  rankings: result.rankings,
};

await writeFile(
  new URL("../data/nearest-percentages.json", import.meta.url),
  `${JSON.stringify(output)}\n`,
);

console.log(
  `Generated ${result.samples.toLocaleString()} samples and refined ${result.rankingTransitions.toLocaleString()} ranking transitions.${convergence ? ` Convergence passed at ${convergence.maximumDisplayedDifference.toFixed(1)} percentage points.` : ""}`,
);
