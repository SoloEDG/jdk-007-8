import { assert, equal } from "./assert.js";
import { createFollowModel } from "../src/features/follow/model/follow.js";
import type { MicAnalyzer } from "../src/features/follow/lib/analyzer.js";
// 桩件：不依赖真实 Web Audio / 麦克风，逐帧喂入色度与电平。
function makeHarness() {
  let running = true,
    abs = 0;
  const played: { pitch: number; when: number; trackId: string }[] = [];
  const takes: { trackId: string; notes: { beat: number }[] }[] = [];
  let frame: { rms: number; chroma: number[]; onset: boolean } | null = null;
  let active = false;
  const stubMic: MicAnalyzer = {
    get active() {
      return active;
    },
    sampleRate: 48000,
    skewMs: 0,
    driftPpm: 0,
    async start() {
      active = true;
    },
    analyze() {
      return frame ? { engineTime: 0, ...frame } : null;
    },
    stop() {
      active = false;
    },
  };
  const model = createFollowModel({
    clock: () => 0,
    transport: {
      view: () => ({ running, absolute: abs, bpm: 120, beats: 16 }),
    },
    play: (n) =>
      played.push({ pitch: n.pitch, when: n.when, trackId: n.trackId }),
    onTake: (t) => takes.push(t),
    getSettings: () => ({
      style: "steady",
      keyRange: "open",
      bassTrackId: "bass",
      drumTrackId: "drum",
    }),
    makeAnalyzer: () => stubMic,
    // 测试按 0.5 拍/帧推进，用小窗口在同样逻辑下快速达到稳定/丢失判定。
    tuning: { voteWindow: 4, lowStreak: 4 },
  });
  const chromaOf = (tones: number[]) => {
    const c = new Array(12).fill(0);
    for (const t of tones) c[t] = 1;
    return c;
  };
  return {
    model,
    get micActive() {
      return active;
    },
    setFrame(tones: number[] | null) {
      frame = tones
        ? { rms: 0.08, chroma: chromaOf(tones), onset: false }
        : { rms: 0.001, chroma: new Array(12).fill(0), onset: false };
    },
    advance(beats: number) {
      const steps = Math.round(beats / 0.5);
      for (let i = 0; i < steps; i++) {
        abs += 0.5;
        model.tick();
      }
    },
    played,
    takes,
  };
}
// 1. 开启后需要连续稳定才提交和弦，并在下一小节边界切换
{
  const h = makeHarness();
  await h.model.enable();
  h.setFrame([0, 4, 7]); // C
  h.advance(2);
  equal(h.model.snapshot().activeChord, null, "未稳定前不应切换和弦");
  assert(!!h.model.snapshot().candidate, "应已显示候选");
  h.advance(12);
  equal(h.model.snapshot().activeChord, "C", "稳定后应提交 C");
  equal(h.model.snapshot().candidate?.stable, true, "候选应标记稳定");
  assert(h.played.some((p) => p.pitch === 36), "应生成 C 低音");
  assert(h.played.some((p) => p.pitch <= 3), "应生成鼓组");
}
// 2. 短暂噪声不能把伴奏带跑
{
  const h = makeHarness();
  await h.model.enable();
  h.setFrame([0, 4, 7]);
  h.advance(16);
  equal(h.model.snapshot().activeChord, "C", "稳定后当前和弦为 C");
  h.setFrame([3, 7, 10]); // 噪声帧
  h.advance(1.5);
  h.setFrame([0, 4, 7]);
  h.advance(8);
  equal(h.model.snapshot().activeChord, "C", "短暂噪声不得切换和弦");
}
// 3. 输入中断：保持上一和弦一小节，再淡出，之后停止生成
{
  const h = makeHarness();
  await h.model.enable();
  h.setFrame([0, 4, 7]);
  h.advance(16);
  equal(h.model.snapshot().activeChord, "C", "中断前当前和弦为 C");
  const before = h.played.length;
  h.setFrame(null);
  h.advance(12);
  assert(h.played.length > before, "保持与淡出阶段仍有音符");
  equal(h.model.snapshot().state, "recovering", "应进入恢复/淡出状态");
  const tail = h.played.length;
  h.advance(8);
  equal(h.played.length, tail, "淡出结束后停止生成");
}
// 4. 录音对齐整循环：arm 后从下一个 16 拍循环开始捕获并提交
{
  const h = makeHarness();
  await h.model.enable();
  h.setFrame([0, 4, 7]);
  h.advance(8); // 先让和弦稳定并开始生成
  equal(h.model.snapshot().activeChord, "C", "录音前和弦已稳定");
  h.model.armCapture();
  h.advance(28); // 跨过目标循环（16–32）并越过其结束边界
  assert(h.takes.length >= 1, "整圈结束应提交生成音符");
  for (const take of h.takes) {
    assert(take.notes.length > 0, "提交片段非空");
    for (const n of take.notes)
      assert(n.beat >= 0 && n.beat < 16, "录音音符必须在一圈内");
  }
}
// 5. 关闭跟随取消未提交录音并关闭麦克风
{
  const h = makeHarness();
  await h.model.enable();
  h.setFrame([0, 4, 7]);
  h.advance(8);
  h.model.armCapture();
  h.advance(4);
  const armed = h.model.disable();
  equal(armed, true, "关闭时应报告存在未提交录音");
  equal(h.model.snapshot().state, "off", "状态回到 off");
  equal(h.micActive, false, "麦克风会话应已关闭");
}
// 6. 录音期间锁定目标轨切换；结束录音保留已提交片段
{
  const h = makeHarness();
  await h.model.enable();
  h.setFrame([0, 4, 7]);
  h.advance(8);
  h.model.armCapture();
  equal(h.model.canSwitchTarget(), false, "录音中禁止切换目标轨");
  h.advance(28); // 完成并提交一整圈
  const committed = h.takes.length;
  assert(committed >= 1, "结束前应有已提交片段");
  h.advance(4); // 新一圈写了一半
  equal(h.model.stopCapture(), true, "结束录音返回曾在录制");
  equal(h.takes.length, committed, "未写完的半圈不得提交");
  equal(h.model.canSwitchTarget(), true, "结束后可切换目标轨");
  h.model.disable();
}
// 7. 淡出停止后，新的稳定和弦到来时伴奏恢复
{
  const h = makeHarness();
  await h.model.enable();
  h.setFrame([0, 4, 7]);
  h.advance(16);
  equal(h.model.snapshot().activeChord, "C", "先稳定在 C");
  h.setFrame(null);
  h.advance(12); // 保持 + 淡出 + 停止
  equal(h.model.snapshot().activeChord, null, "淡出后当前和弦清空");
  h.setFrame([5, 9, 0]); // F 大三和弦 F A C
  h.advance(16);
  equal(h.model.snapshot().activeChord, "F", "新稳定和弦应恢复并切换到 F");
  assert(h.played.some((p) => p.pitch === 41), "应生成 F 低音(41)");
}
console.log("follow state-machine tests passed");
