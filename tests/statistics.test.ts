import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PLANET_IDS,
  RANGE_END_MS,
  RANGE_START_MS,
  type PlanetId,
} from "../lib/astronomy.ts";
import {
  percentagesAt,
  prepareNearestTimeline,
  prepareNearestTimelines,
  type NearestTransition,
} from "../lib/nearest-statistics.ts";

type Statistics = {
  interval: { start: string; endExclusive: string };
  method: {
    sampleHours: number;
    transitionToleranceMinutes: number;
    samples: number;
    detectedTransitions: number;
  };
  percentages: Record<
    PlanetId,
    Array<{ id: PlanetId; percentage: number }>
  >;
  timelines: Record<PlanetId, NearestTransition[]>;
};

const statistics = JSON.parse(
  await readFile(new URL("../data/nearest-percentages.json", import.meta.url), "utf8"),
) as Statistics;

test("statistics cover the fixed half-open analysis interval", () => {
  assert.equal(statistics.interval.start, "2000-01-01T00:00:00.000Z");
  assert.equal(statistics.interval.endExclusive, "4000-01-01T00:00:00.000Z");
  assert.equal(statistics.method.sampleHours, 6);
  assert.equal(statistics.method.transitionToleranceMinutes, 1);
  assert.ok(statistics.method.samples > 2_900_000);
});

test("every selected planet has deterministic non-self percentages totaling 100", () => {
  for (const selected of PLANET_IDS) {
    const entries = statistics.percentages[selected];
    assert.ok(entries.length > 0);
    assert.ok(entries.length <= 7);
    assert.equal(
      Math.round(entries.reduce((sum, entry) => sum + entry.percentage, 0) * 10),
      1_000,
    );
    for (const entry of entries) {
      assert.notEqual(entry.id, selected);
      assert.ok(PLANET_IDS.includes(entry.id));
      assert.ok(entry.percentage > 0);
    }
  }
});

test("percentage rows are sorted descending", () => {
  for (const selected of PLANET_IDS) {
    const entries = statistics.percentages[selected];
    for (let index = 1; index < entries.length; index += 1) {
      assert.ok(entries[index - 1].percentage >= entries[index].percentage);
    }
  }
});

test("transition timelines cover every planet and begin at the range start", () => {
  let transitionRuns = 0;
  for (const selected of PLANET_IDS) {
    const timeline = statistics.timelines[selected];
    assert.ok(timeline.length > 0);
    assert.deepEqual(timeline[0], [0, timeline[0][1]]);
    transitionRuns += timeline.length;
    for (let index = 0; index < timeline.length; index += 1) {
      const [offsetMinutes, nearest] = timeline[index];
      assert.notEqual(nearest, selected);
      assert.ok(PLANET_IDS.includes(nearest));
      if (index > 0) assert.ok(offsetMinutes > timeline[index - 1][0]);
    }
  }
  assert.equal(
    transitionRuns,
    statistics.method.detectedTransitions + PLANET_IDS.length,
  );
});

test("live percentages start at zero and total 100 after time advances", () => {
  const prepared = prepareNearestTimelines(statistics.timelines);
  for (const selected of PLANET_IDS) {
    const atStart = percentagesAt(prepared[selected], RANGE_START_MS);
    assert.equal(atStart.length, 7);
    assert.equal(
      atStart.reduce((sum, entry) => sum + entry.percentage, 0),
      0,
    );

    for (const dateMs of [
      RANGE_START_MS + 30 * 86_400_000,
      Date.UTC(2002, 0, 1),
      RANGE_END_MS,
    ]) {
      const entries = percentagesAt(prepared[selected], dateMs);
      assert.equal(entries.length, 7);
      assert.equal(
        Math.round(entries.reduce((sum, entry) => sum + entry.percentage, 0) * 10),
        1_000,
      );
    }

    assert.deepEqual(
      percentagesAt(prepared[selected], RANGE_END_MS).filter(
        (entry) => entry.percentage > 0,
      ),
      statistics.percentages[selected],
    );
  }
});

test("a single nearest run displays 100% and rewinding is date-deterministic", () => {
  const timeline = prepareNearestTimeline("earth", [
    [0, "venus"],
    [60, "mars"],
  ]);
  const thirtyMinutes = percentagesAt(timeline, RANGE_START_MS + 30 * 60_000);
  assert.equal(thirtyMinutes[0].id, "venus");
  assert.equal(thirtyMinutes[0].percentage, 100);

  const ninetyMinutes = percentagesAt(timeline, RANGE_START_MS + 90 * 60_000);
  assert.deepEqual(
    ninetyMinutes.slice(0, 2),
    [
      { id: "venus", percentage: 66.7 },
      { id: "mars", percentage: 33.3 },
    ],
  );
  assert.deepEqual(
    percentagesAt(timeline, RANGE_START_MS + 30 * 60_000),
    thirtyMinutes,
  );
});
