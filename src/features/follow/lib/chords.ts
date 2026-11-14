import type { FollowKeyRange } from "@/shared/types";
export const PITCH_CLASS_COUNT = 12;
export const CHROMA_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
export type ChordKind = "maj" | "min" | "sus" | "dim";
export type ChordTemplate = {
  kind: ChordKind;
  suffix: string;
  tones: readonly number[];
};
export const CHORD_TEMPLATES: readonly ChordTemplate[] = [
  { kind: "maj", suffix: "", tones: [0, 4, 7] },
  { kind: "min", suffix: "m", tones: [0, 3, 7] },
  { kind: "sus", suffix: "sus", tones: [0, 5, 7] },
  { kind: "dim", suffix: "dim", tones: [0, 3, 6] },
];
export type ChordGuess = {
  root: number;
  kind: ChordKind;
  label: string;
  confidence: number;
};
/** 调性范围：约束允许的根音，避免识别结果离调乱跑。 */
const ALLOWED_ROOTS: Record<FollowKeyRange, readonly number[]> = {
  open: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  bright: [0, 2, 4, 7, 9],
  warm: [0, 2, 5, 7, 9, 10],
};
/** 把任意根音吸附到调性范围内最近的允许音。 */
export function snapToRange(root: number, range: FollowKeyRange): number {
  const allowed = ALLOWED_ROOTS[range];
  if (allowed.includes(root)) return root;
  let best = allowed[0],
    bestDist = 12;
  for (const candidate of allowed) {
    const clockwise = (candidate - root + 12) % 12;
    const counter = (root - candidate + 12) % 12;
    const d = Math.min(clockwise, counter);
    // 等距时优先向更高音（顺时针）吸附，结果稳定可预期。
    if (d < bestDist || (d === bestDist && clockwise <= counter)) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}
export const chordLabel = (root: number, kind: ChordKind) =>
  CHROMA_NAMES[root] + CHORD_TEMPLATES.find((t) => t.kind === kind)!.suffix;
/** 低音音高：根音落在 C2–B2 八度。 */
export const bassPitch = (root: number) => 36 + root;
/**
 * 依据色度向量给候选和弦打分。
 * 分数为模板音位上的能量和，置信度结合绝对能量与最佳/次佳间距，
 * 能量过低或差距过小都会返回低置信度，便于上层判定“听不清”。
 */
export function guessChord(
  chroma: readonly number[],
  range: FollowKeyRange,
): ChordGuess | null {
  const total = chroma.reduce((sum, value) => sum + value, 0);
  if (total < 1e-6) return null;
  let best: { root: number; kind: ChordKind; score: number } | null = null,
    second = 0;
  for (const template of CHORD_TEMPLATES)
    for (let root = 0; root < PITCH_CLASS_COUNT; root++) {
      if (!ALLOWED_ROOTS[range].includes(root)) continue;
      let score = 0;
      for (const tone of template.tones)
        score += chroma[(root + tone) % PITCH_CLASS_COUNT];
      // 根音略微加权，强化低音提示。
      score += chroma[root] * 0.15;
      if (!best || score > best.score) {
        if (best) second = Math.max(second, best.score);
        best = { root, kind: template.kind, score };
      } else second = Math.max(second, score);
    }
  if (!best) return null;
  const margin = best.score - second;
  const confidence = Math.max(
    0,
    Math.min(1, (best.score / total) * 0.85 + margin / (total + 1e-9) * 1.4),
  );
  return {
    root: best.root,
    kind: best.kind,
    label: chordLabel(best.root, best.kind),
    confidence,
  };
}
