import type { Note } from "@/shared/types";
import { wrap, clamp } from "@/shared/math";
export function recordedNote(
  pitch: number,
  start: number,
  end: number,
  length: number,
  velocity: number,
  grid: number,
): Note {
  const beat = wrap(Math.round(start / grid) * grid, length);
  return {
    id: crypto.randomUUID(),
    pitch,
    beat,
    duration: clamp(
      Math.round(Math.max(grid, end - start) / grid) * grid,
      grid,
      length - beat,
    ),
    velocity,
  };
}
export function captureBoundary(absolute: number, length: number) {
  return Math.ceil((absolute + 0.0001) / length) * length;
}
