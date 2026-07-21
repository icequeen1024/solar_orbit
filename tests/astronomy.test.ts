import assert from "node:assert/strict";
import test from "node:test";
import {
  PLANETS,
  PLANET_IDS,
  RANGE_END_MS,
  RANGE_START_MS,
  SUN,
  allPlanetPositions,
  clampToRange,
  nearestPlanetFromPositions,
  physicalDistance,
  planetPosition,
  type PlanetPosition,
} from "../lib/astronomy.ts";

test("defines only the eight approved planets", () => {
  assert.deepEqual(
    PLANET_IDS,
    [
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
    ],
  );
  assert.equal(PLANETS.length, 8);
});

test("keeps physical body radii in their true relative order", () => {
  const earth = PLANETS.find((planet) => planet.id === "earth")!;
  const jupiter = PLANETS.find((planet) => planet.id === "jupiter")!;
  assert.ok(SUN.radiusKm / earth.radiusKm > 109);
  assert.ok(SUN.radiusKm / earth.radiusKm < 110);
  assert.ok(jupiter.radiusKm / earth.radiusKm > 10);
  assert.ok(jupiter.radiusKm / earth.radiusKm < 12);
});

test("produces finite heliocentric positions across the supported range", () => {
  for (const dateMs of [RANGE_START_MS, Date.UTC(3000, 0, 1), RANGE_END_MS]) {
    const positions = allPlanetPositions(dateMs);
    assert.equal(positions.length, 8);
    for (const position of positions) {
      assert.ok(Number.isFinite(position.x));
      assert.ok(Number.isFinite(position.y));
      assert.ok(Number.isFinite(position.z));
      assert.ok(position.distanceFromSunAu > 0.25);
      assert.ok(position.distanceFromSunAu < 32);
    }
  }
});

test("Earth remains near one astronomical unit at J2000", () => {
  const earth = planetPosition("earth", Date.UTC(2000, 0, 1, 12));
  assert.ok(earth.distanceFromSunAu > 0.98);
  assert.ok(earth.distanceFromSunAu < 1.02);
});

test("nearest selection uses physical coordinates and stable planet-order ties", () => {
  const positions: PlanetPosition[] = [
    { id: "earth", x: 0, y: 0, z: 0, distanceFromSunAu: 0 },
    { id: "venus", x: -1, y: 0, z: 0, distanceFromSunAu: 1 },
    { id: "mercury", x: 1, y: 0, z: 0, distanceFromSunAu: 1 },
    { id: "mars", x: 3, y: 0, z: 0, distanceFromSunAu: 3 },
  ];
  assert.equal(nearestPlanetFromPositions("earth", positions).planet.id, "mercury");
  assert.equal(
    nearestPlanetFromPositions("earth", positions, ["earth", "venus"]).planet.id,
    "venus",
  );
  assert.throws(
    () => nearestPlanetFromPositions("earth", positions, ["earth"]),
    /No nearest planet/,
  );
  assert.equal(physicalDistance(positions[0], positions[3]), 3);
});

test("range clamping never wraps dates", () => {
  assert.equal(clampToRange(RANGE_START_MS - 1), RANGE_START_MS);
  assert.equal(clampToRange(RANGE_END_MS + 1), RANGE_END_MS);
  assert.equal(clampToRange(Date.UTC(2500, 0, 1)), Date.UTC(2500, 0, 1));
});
