import type { Note, NoteInput, Instrument } from "@/shared/types";
import { captureBoundary, recordedNote } from "../lib/quantize";
export function createRecorder() {
  let status: "idle" | "waiting" | "recording" = "idle",
    trackId: string | null = null,
    instrument: Instrument = "drums",
    start = 0,
    length = 16,
    grid = 0.25,
    draft: Note[] = [];
  const held = new Map<string, { note: NoteInput; beat: number }>();
  const release = (id: string, absolute: number) => {
    const h = held.get(id);
    if (!h) return;
    held.delete(id);
    if (draft.length < 2048)
      draft.push(
        recordedNote(
          h.note.pitch,
          h.beat - start,
          Math.min(start + length, absolute) - start,
          length,
          h.note.velocity,
          grid,
        ),
      );
  };
  return {
    snapshot() {
      return {
        status,
        trackId,
        start,
        length,
        draft: structuredClone(draft),
        grid,
      };
    },
    grid(value: number) {
      if (status === "idle" && [0.25, 0.5, 1].includes(value)) grid = value;
    },
    arm(id: string, kind: Instrument, absolute: number, beats: number) {
      if (status !== "idle") return;
      trackId = id;
      instrument = kind;
      start = captureBoundary(absolute, beats);
      length = beats;
      draft = [];
      held.clear();
      status = "waiting";
    },
    down(id: string, note: NoteInput, absolute: number) {
      if (
        status !== "recording" ||
        note.instrument !== instrument ||
        held.has(id) ||
        draft.length + held.size >= 2048
      )
        return;
      held.set(id, { note, beat: absolute });
    },
    up: release,
    advance(absolute: number) {
      if (status === "waiting" && absolute >= start) status = "recording";
      if (status === "recording" && absolute >= start + length) {
        for (const id of held.keys()) release(id, start + length);
        const result = { trackId: trackId!, notes: structuredClone(draft) };
        status = "idle";
        trackId = null;
        draft = [];
        held.clear();
        return result;
      }
      return null;
    },
    cancel() {
      status = "idle";
      trackId = null;
      draft = [];
      held.clear();
    },
  };
}
export type Recorder = ReturnType<typeof createRecorder>;
