import type { FollowStyle } from "@/shared/types";
import { bassPitch } from "./chords";
export type PatternNote = {
  pitch: number;
  beat: number;
  duration: number;
  velocity: number;
};
const note = (
  pitch: number,
  beat: number,
  duration: number,
  velocity: number,
): PatternNote => ({ pitch, beat, duration, velocity });
/** 鼓组音高沿用鼓垫约定：0 底鼓 / 1 军鼓 / 2 踩镲 / 3 开镲。 */
export function drumBar(style: FollowStyle): PatternNote[] {
  if (style === "steady") {
    return [
      note(0, 0, 0.12, 0.9),
      note(0, 2, 0.12, 0.82),
      note(1, 1, 0.12, 0.7),
      note(1, 3, 0.12, 0.7),
      ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b) =>
        note(2, b, 0.12, b % 1 === 0 ? 0.5 : 0.34),
      ),
    ];
  }
  if (style === "groove") {
    return [
      note(0, 0, 0.12, 0.92),
      note(0, 2, 0.12, 0.8),
      note(0, 3.5, 0.12, 0.6),
      note(1, 1, 0.12, 0.72),
      note(1, 3, 0.12, 0.72),
      ...[0, 0.5, 1, 1.5, 2, 2.5, 3].map((b) =>
        note(2, b, 0.12, b % 1 === 0 ? 0.48 : 0.36),
      ),
      note(3, 3.5, 0.12, 0.42),
    ];
  }
  return [
    note(0, 0, 0.12, 0.85),
    note(1, 3, 0.12, 0.62),
    ...[0, 2].map((b) => note(2, b, 0.12, 0.4)),
  ];
}
export function bassBar(root: number, style: FollowStyle): PatternNote[] {
  const low = bassPitch(root),
    fifth = low + 7,
    octave = low + 12;
  if (style === "steady")
    return [0, 1, 2, 3].map((b) => note(low, b, 0.92, b === 0 ? 0.62 : 0.5));
  if (style === "groove")
    return [
      note(low, 0, 1.4, 0.64),
      note(fifth, 1.5, 0.7, 0.46),
      note(low, 2, 0.9, 0.55),
      note(octave, 3.5, 0.5, 0.42),
    ];
  return [
    note(low, 0, 3.4, 0.58),
    note(fifth, 3, 0.9, 0.4),
  ];
}
/**
 * 输入中断 / 置信度不足时的收尾：保留上一和弦的节奏骨架，
 * 在一小节内线性淡出，结束后不再生成新音符。
 */
export function withFade(notes: readonly PatternNote[]): PatternNote[] {
  return notes.map((n) => ({
    ...n,
    velocity: Math.max(
      0.05,
      n.velocity * (1 - ((n.beat + 0.5) / 4) * 0.9),
    ),
  }));
}
