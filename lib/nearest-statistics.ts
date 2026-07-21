import {
  PLANET_IDS,
  RANGE_END_MS,
  RANGE_START_MS,
  isPlanetId,
  type PlanetId,
} from "./astronomy.ts";

const MINUTE_MS = 60_000;
const DISPLAY_TENTHS_TOTAL = 1_000;

export type PercentageEntry = { id: PlanetId; percentage: number };
export type NearestTransition = readonly [offsetMinutes: number, id: PlanetId];
export type NearestTimelines = Record<PlanetId, readonly NearestTransition[]>;

export type PreparedNearestTimeline = {
  selected: PlanetId;
  starts: Float64Array;
  nearestIds: PlanetId[];
  cumulativeMinutes: Float64Array;
};

function planetOrder(id: PlanetId) {
  return PLANET_IDS.indexOf(id);
}

export function prepareNearestTimeline(
  selected: PlanetId,
  transitions: readonly NearestTransition[],
): PreparedNearestTimeline {
  if (transitions.length === 0 || transitions[0][0] !== 0) {
    throw new Error(`The ${selected} timeline must begin at minute zero.`);
  }

  const starts = new Float64Array(transitions.length);
  const nearestIds: PlanetId[] = [];
  const cumulativeMinutes = new Float64Array(
    transitions.length * PLANET_IDS.length,
  );

  for (let index = 0; index < transitions.length; index += 1) {
    const [startMinutes, nearestId] = transitions[index];
    if (
      !Number.isFinite(startMinutes) ||
      startMinutes < 0 ||
      (index > 0 && startMinutes <= transitions[index - 1][0])
    ) {
      throw new Error(`The ${selected} timeline is not strictly increasing.`);
    }
    if (!isPlanetId(nearestId) || nearestId === selected) {
      throw new Error(`The ${selected} timeline contains an invalid neighbor.`);
    }

    starts[index] = startMinutes;
    nearestIds.push(nearestId);

    if (index === 0) continue;
    const previousRow = (index - 1) * PLANET_IDS.length;
    const currentRow = index * PLANET_IDS.length;
    for (let candidate = 0; candidate < PLANET_IDS.length; candidate += 1) {
      cumulativeMinutes[currentRow + candidate] =
        cumulativeMinutes[previousRow + candidate];
    }
    const previousNearestIndex = planetOrder(nearestIds[index - 1]);
    cumulativeMinutes[currentRow + previousNearestIndex] +=
      startMinutes - starts[index - 1];
  }

  return { selected, starts, nearestIds, cumulativeMinutes };
}

export function prepareNearestTimelines(timelines: NearestTimelines) {
  return Object.fromEntries(
    PLANET_IDS.map((selected) => [
      selected,
      prepareNearestTimeline(selected, timelines[selected]),
    ]),
  ) as Record<PlanetId, PreparedNearestTimeline>;
}

function activeTransitionIndex(starts: Float64Array, elapsedMinutes: number) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= elapsedMinutes) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function percentagesAt(
  timeline: PreparedNearestTimeline,
  dateMs: number,
): PercentageEntry[] {
  const boundedDateMs = Math.max(RANGE_START_MS, Math.min(RANGE_END_MS, dateMs));
  const elapsedMinutes = (boundedDateMs - RANGE_START_MS) / MINUTE_MS;
  const candidates = PLANET_IDS.filter((id) => id !== timeline.selected);

  if (elapsedMinutes <= 0) {
    return candidates.map((id) => ({ id, percentage: 0 }));
  }

  const activeIndex = activeTransitionIndex(timeline.starts, elapsedMinutes);
  const activeNearest = timeline.nearestIds[activeIndex];
  const rowOffset = activeIndex * PLANET_IDS.length;
  const entries = candidates.map((id) => {
    const index = planetOrder(id);
    const durationMinutes =
      timeline.cumulativeMinutes[rowOffset + index] +
      (id === activeNearest
        ? elapsedMinutes - timeline.starts[activeIndex]
        : 0);
    const exactTenths = (durationMinutes / elapsedMinutes) * DISPLAY_TENTHS_TOTAL;
    return {
      id,
      floorTenths: Math.floor(exactTenths),
      remainder: exactTenths - Math.floor(exactTenths),
    };
  });

  let remainingTenths =
    DISPLAY_TENTHS_TOTAL -
    entries.reduce((sum, entry) => sum + entry.floorTenths, 0);
  const remainderOrder = [...entries].sort(
    (a, b) => b.remainder - a.remainder || planetOrder(a.id) - planetOrder(b.id),
  );
  for (const entry of remainderOrder) {
    if (remainingTenths <= 0) break;
    entry.floorTenths += 1;
    remainingTenths -= 1;
  }

  return entries
    .map(({ id, floorTenths }) => ({ id, percentage: floorTenths / 10 }))
    .sort(
      (a, b) =>
        b.percentage - a.percentage || planetOrder(a.id) - planetOrder(b.id),
    );
}
