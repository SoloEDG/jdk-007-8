import { assert, equal } from "./assert.js";
import {
  guessChord,
  snapToRange,
  bassPitch,
  chordLabel,
} from "../src/features/follow/lib/chords.js";
import { bassBar, drumBar, withFade } from "../src/features/follow/lib/patterns.js";
import { fitClock } from "../src/features/follow/lib/analyzer.js";
const chroma = (tones: number[]) => {
  const c = new Array(12).fill(0);
  for (const t of tones) c[t] = 1;
  return c;
};
// 1. 大调 / 小调和弦识别
{
  const cMaj = guessChord(chroma([0, 4, 7]), "open")!;
  equal(cMaj.label, "C", "C 大调应识别为 C");
  assert(cMaj.confidence > 0.5, "大三和弦应高置信度");
  const aMin = guessChord(chroma([9, 0, 4]), "open")!;
  equal(aMin.label, "Am", "A C E 应识别为 Am");
}
// 2. 静默（无能量）返回 null；极低能量门限由调用方 RMS 检查负责
{
  equal(guessChord(new Array(12).fill(0), "open"), null, "静默应返回 null");
  // 有能量但含糊的色度仍可给出候选，置信度明显低于干净三和弦
  const muddy = guessChord(new Array(12).fill(0.0001), "open")!;
  const clean = guessChord(chroma([0, 4, 7]), "open")!;
  assert(clean.confidence > muddy.confidence, "干净三和弦置信度应更高");
}
// 3. 调性范围吸附：bright 只允许 C D E G A，warm 只允许 C D F G A Bb
{
  equal(snapToRange(3, "bright"), 4, "Eb(3) 唯一最近为 E(4)");
  equal(snapToRange(8, "warm"), 9, "Ab(8) 唯一最近为 A(9)");
  equal(snapToRange(7, "bright"), 7, "G 已在范围内保持");
  // 平局（C# 到 C/D 等距）按顺时针优先，稳定落到 D
  equal(snapToRange(1, "bright"), 2, "C# 平局向高音吸附到 D");
  const guess = guessChord(chroma([1, 5, 8]), "bright")!;
  assert(
    [0, 2, 4, 7, 9].includes(guess.root),
    "识别根音必须落在调性范围",
  );
}
// 4. 低音音高为根音 C2 八度
{
  equal(bassPitch(0), 36, "C 根音低音为 36");
  equal(bassPitch(9), 45, "A 根音低音为 45");
  equal(chordLabel(3, "min"), "D#m", "和弦标签");
}
// 5. 三种风格都生成 4 拍内的合法鼓组/低音
for (const style of ["steady", "groove", "sparse"] as const) {
  const drums = drumBar(style);
  const bass = bassBar(36, style);
  assert(drums.length >= 3, `${style} 鼓组应有多个音`);
  assert(bass.length >= 1, `${style} 低音至少一个音`);
  for (const n of [...drums, ...bass]) {
    assert(n.beat >= 0 && n.beat < 4, "音符必须落在一小节内");
    assert(n.velocity > 0 && n.velocity <= 1, "力度合法");
  }
  assert(drums.every((n) => n.pitch >= 0 && n.pitch <= 3), "鼓组音高 0..3");
}
// 6. 淡出：力度随拍位线性衰减，且越往后越弱
{
  const faded = withFade(bassBar(36, "groove"));
  const early = faded.find((n) => n.beat === 0)!;
  const late = faded.find((n) => n.beat >= 3)!;
  assert(late.velocity < early.velocity, "后拍力度应小于前拍");
  assert(faded.every((n) => n.velocity >= 0.05), "淡出力度有下限");
}
// 7. 时钟校准：纯固定偏置与带漂移两种情形都应被最小二乘还原
{
  const offsetPairs = Array.from({ length: 8 }, (_, i) => ({
    a: i * 0.5,
    e: i * 0.5 + 0.02,
  }));
  const fixed = fitClock(offsetPairs);
  assert(Math.abs(fixed.rate - 1) < 1e-9, "纯偏置下漂移率应为 1");
  assert(Math.abs(fixed.offset - 0.02) < 1e-9, "应还原 20ms 固定偏置");
  const driftPairs = Array.from({ length: 8 }, (_, i) => ({
    a: i * 0.5,
    e: i * 0.5 * 1.001 + 0.005,
  }));
  const drift = fitClock(driftPairs);
  assert(Math.abs(drift.rate - 1.001) < 1e-9, "应还原 0.1% 漂移率");
  assert(Math.abs(drift.offset - 0.005) < 1e-9, "应还原漂移情形的偏置");
  equal(fitClock([]).rate, 1, "样本不足时回退单位速率");
}
console.log("chord/pattern tests passed");
