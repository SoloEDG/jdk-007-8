import { assert, equal } from "./assert.js";
import { validateSession } from "../src/features/arrangement/lib/validation.js";
import type { Session } from "../src/shared/types.js";
const base = (): Session => ({
  version: 1,
  title: "测试作品",
  bpm: 108,
  beats: 16,
  master: 0.7,
  channels: {
    k1: { volume: 0.8, muted: false },
    d1: { volume: 0.8, muted: false },
  },
  tracks: [
    { id: "k1", name: "低音", instrument: "keys", color: "#8fbfff", notes: [] },
    { id: "d1", name: "鼓组", instrument: "drums", color: "#d5f377", notes: [] },
  ],
  follow: { style: "groove", keyRange: "warm", bassTrackId: "k1", drumTrackId: "d1" },
});
// 1. 合法跟随设置原样保留
{
  const valid = validateSession(base());
  assert(!!valid.follow, "跟随设置应被保留");
  equal(valid.follow!.style, "groove", "风格保留");
  equal(valid.follow!.keyRange, "warm", "调性范围保留");
  equal(valid.follow!.bassTrackId, "k1", "低音目标轨保留");
  equal(valid.follow!.drumTrackId, "d1", "鼓组目标轨保留");
}
// 2. 缺少 follow 字段时为 null（向后兼容旧存档）
{
  const old = base();
  delete old.follow;
  equal(validateSession(old).follow, null, "旧存档 follow 为 null");
}
// 3. 目标轨引用不存在的轨道时报错
{
  const broken = base();
  broken.follow = { ...broken.follow!, bassTrackId: "ghost" };
  let threw = false;
  try {
    validateSession(broken);
  } catch {
    threw = true;
  }
  assert(threw, "失效的目标轨引用应被拒绝");
}
// 4. 目标轨乐器不匹配时报错
{
  const mismatch = base();
  mismatch.follow = { ...mismatch.follow!, bassTrackId: "d1" };
  let threw = false;
  try {
    validateSession(mismatch);
  } catch {
    threw = true;
  }
  assert(threw, "低音指向鼓组轨应被拒绝");
}
// 5. 非法风格/调性范围报错
{
  const bad = base();
  bad.follow = { ...bad.follow!, style: "jazz" as never };
  let threw = false;
  try {
    validateSession(bad);
  } catch {
    threw = true;
  }
  assert(threw, "非法风格应被拒绝");
}
console.log("validation tests passed");
