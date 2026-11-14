import type { Track, Instrument, Note, Session } from "@/shared/types";
import { uid } from "@/shared/math";
import { validateSession } from "../lib/validation";
export function createArrangement() {
  let tracks: Track[] = [],
    selected: string | null = null,
    title = "未命名夜航";
  const colors = [
    "#d5f377",
    "#bca5f4",
    "#8fbfff",
    "#f4af84",
    "#80cfbb",
    "#ed94b4",
    "#cec080",
    "#a6b6c9",
  ];
  return {
    snapshot() {
      return { tracks: structuredClone(tracks), selected, title };
    },
    selected() {
      return tracks.find((t) => t.id === selected)
        ? structuredClone(tracks.find((t) => t.id === selected)!)
        : null;
    },
    select(id: string) {
      if (tracks.some((t) => t.id === id)) selected = id;
    },
    add(instrument: Instrument) {
      if (tracks.length >= 8)
        throw new Error("最多支持 8 条轨道，请先移除一条");
      const t: Track = {
        id: uid(),
        name: `${instrument === "drums" ? "鼓组" : "琴键"} ${tracks.length + 1}`,
        instrument,
        color: colors[tracks.length % colors.length],
        notes: [],
      };
      tracks = [...tracks, t];
      selected = t.id;
      return t.id;
    },
    remove(id: string) {
      tracks = tracks.filter((t) => t.id !== id);
      if (selected === id) selected = tracks[0]?.id ?? null;
    },
    commit(id: string, notes: Note[]) {
      if (!tracks.some((t) => t.id === id)) throw new Error("录音目标已不存在");
      tracks = tracks.map((t) =>
        t.id === id ? { ...t, notes: structuredClone(notes) } : t,
      );
    },
    resizeLoop(beats: number) {
      tracks = tracks.map((track) => ({
        ...track,
        notes: track.notes
          .filter((note) => note.beat < beats)
          .map((note) => ({
            ...note,
            duration: Math.min(note.duration, beats - note.beat),
          })),
      }));
    },
    clear(id: string) {
      this.commit(id, []);
    },
    restore(raw: Session) {
      const session = validateSession(raw);
      tracks = session.tracks;
      title = session.title;
      selected = tracks[0]?.id ?? null;
      return session;
    },
    forPlayback() {
      return structuredClone(tracks);
    },
  };
}
export type Arrangement = ReturnType<typeof createArrangement>;
