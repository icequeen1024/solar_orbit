import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PLANET_IDS, type PlanetId } from "../lib/astronomy.ts";

type Statistics = {
  interval: { start: string; endExclusive: string };
  method: {
    sampleHours: number;
    transitionToleranceMinutes: number;
    samples: number;
  };
  percentages: Record<
    PlanetId,
    Array<{ id: PlanetId; percentage: number }>
  >;
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
