import { RANGE_END_MS, RANGE_START_MS } from "./astronomy.ts";

export type PlaybackDirection = 1 | -1;

export function playbackDirectionFromBoundary(
  dateMs: number,
  direction: PlaybackDirection,
): PlaybackDirection {
  if (dateMs <= RANGE_START_MS) return 1;
  if (dateMs >= RANGE_END_MS) return -1;
  return direction;
}
