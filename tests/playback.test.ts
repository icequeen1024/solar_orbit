import assert from "node:assert/strict";
import test from "node:test";
import { RANGE_END_MS, RANGE_START_MS } from "../lib/astronomy.ts";
import { playbackDirectionFromBoundary } from "../lib/playback.ts";

test("playback always moves forward from the 2000 boundary", () => {
  assert.equal(playbackDirectionFromBoundary(RANGE_START_MS, -1), 1);
  assert.equal(playbackDirectionFromBoundary(RANGE_START_MS, 1), 1);
});

test("playback always moves backward from the 4000 boundary", () => {
  assert.equal(playbackDirectionFromBoundary(RANGE_END_MS, 1), -1);
  assert.equal(playbackDirectionFromBoundary(RANGE_END_MS, -1), -1);
});

test("playback keeps the selected direction between the boundaries", () => {
  const middle = Date.UTC(3000, 0, 1);
  assert.equal(playbackDirectionFromBoundary(middle, 1), 1);
  assert.equal(playbackDirectionFromBoundary(middle, -1), -1);
});
