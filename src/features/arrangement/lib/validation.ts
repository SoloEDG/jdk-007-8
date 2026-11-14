import type { Session, Track, Note, FollowSettings } from "@/shared/types";
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const finite = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
const STYLES = ["steady", "groove", "sparse"];
const RANGES = ["open", "bright", "warm"];
function validateFollow(raw: unknown, ids: ReadonlySet<string>): FollowSettings | null {
  if (raw === null || raw === undefined) return null;
  if (!object(raw)) throw new Error("跟随设置损坏");
  if (
    typeof raw.style !== "string" ||
    !STYLES.includes(raw.style) ||
    typeof raw.keyRange !== "string" ||
    !RANGES.includes(raw.keyRange)
  )
    throw new Error("跟随风格或调性范围不受支持");
  const trackRef = (value: unknown): string | null => {
    if (value === null) return null;
    if (typeof value !== "string" || !ids.has(value))
      throw new Error("跟随目标轨道已失效，请重新选择");
    return value;
  };
  return {
    style: raw.style as FollowSettings["style"],
    keyRange: raw.keyRange as FollowSettings["keyRange"],
    bassTrackId: trackRef(raw.bassTrackId),
    drumTrackId: trackRef(raw.drumTrackId),
  };
}
export function validateSession(raw: unknown): Session {
  if (
    !object(raw) ||
    raw.version !== 1 ||
    typeof raw.title !== "string" ||
    raw.title.length > 80 ||
    !finite(raw.bpm, 40, 220) ||
    ![4, 8, 16, 32].includes(raw.beats as number) ||
    !Array.isArray(raw.tracks) ||
    raw.tracks.length > 8 ||
    !object(raw.channels) ||
    !finite(raw.master, 0, 1)
  )
    throw new Error("存档格式或版本不受支持");
  const ids = new Set<string>();
  const noteIds = new Set<string>();
  for (const value of raw.tracks) {
    if (!object(value)) throw new Error("轨道损坏");
    const t = value as unknown as Track;
    if (
      typeof t.id !== "string" ||
      ids.has(t.id) ||
      !t.id ||
      typeof t.name !== "string" ||
      t.name.length > 32 ||
      !["drums", "keys"].includes(t.instrument) ||
      !/^#[0-9a-f]{6}$/i.test(t.color) ||
      !Array.isArray(t.notes) ||
      t.notes.length > 2048
    )
      throw new Error("轨道数据无效");
    ids.add(t.id);
    for (const n of t.notes as Note[]) {
      if (
        !object(n) ||
        typeof n.id !== "string" ||
        noteIds.has(n.id) ||
        !finite(
          n.pitch,
          t.instrument === "drums" ? 0 : 24,
          t.instrument === "drums" ? 3 : 108,
        ) ||
        !Number.isInteger(n.pitch) ||
        !finite(n.beat, 0, (raw.beats as number) - 0.000001) ||
        !finite(n.duration, 0.01, raw.beats as number) ||
        !finite(n.velocity, 0.01, 1)
      )
        throw new Error("音符数据无效");
      noteIds.add(n.id);
    }
    const c = raw.channels[t.id];
    if (!object(c) || !finite(c.volume, 0, 1) || typeof c.muted !== "boolean")
      throw new Error("混音数据无效");
  }
  const follow = validateFollow(raw.follow, ids);
  if (follow) {
    const byId = new Map(
      (raw.tracks as unknown as Track[]).map((t) => [t.id, t]),
    );
    if (
      (follow.bassTrackId &&
        byId.get(follow.bassTrackId)?.instrument !== "keys") ||
      (follow.drumTrackId &&
        byId.get(follow.drumTrackId)?.instrument !== "drums")
    )
      throw new Error("跟随目标轨道与乐器不匹配");
  }
  const result = structuredClone(raw) as unknown as Session;
  result.follow = follow;
  return result;
}
