import { wrap } from "@/shared/math";
export const secondsToBeats = (seconds: number, bpm: number) =>
  (seconds * bpm) / 60;
export function clockBeat(
  now: number,
  anchor: number,
  offset: number,
  bpm: number,
) {
  return offset + secondsToBeats(Math.max(0, now - anchor), bpm);
}
export function occurrences(
  beat: number,
  from: number,
  to: number,
  length: number,
) {
  const result: number[] = [];
  let at = beat + Math.max(0, Math.ceil((from - beat) / length)) * length;
  while (at < to) {
    if (at >= from) result.push(at);
    at += length;
  }
  return result;
}
export const loopPosition = (absolute: number, beats: number) =>
  wrap(absolute, beats);
