import type { Instrument, ScheduledNote } from "@/shared/types";
import { synthesize, type Voice } from "../lib/voices";
export function createEngine() {
  let context: AudioContext | null = null;
  let destination: ((id: string) => AudioNode) | null = null;
  const voices = new Map<string, Voice>();
  const held = new Map<string, string>();
  return {
    get context() {
      return context;
    },
    async unlock() {
      context ??= new AudioContext();
      if (context.state === "suspended") await context.resume();
      return context;
    },
    route(resolve: (id: string) => AudioNode) {
      destination = resolve;
    },
    play(note: ScheduledNote, key?: string) {
      if (!context || !destination) return;
      for (const [id, v] of voices)
        if (v.end < context.currentTime) voices.delete(id);
      const id = crypto.randomUUID();
      voices.set(id, synthesize(context, destination(note.trackId), note));
      if (key && note.instrument === "keys") held.set(key, id);
    },
    release(key: string) {
      const id = held.get(key);
      if (id) {
        voices.get(id)?.stop();
        voices.delete(id);
        held.delete(key);
      }
    },
    releaseHeld() {
      for (const id of held.values()) {
        voices.get(id)?.stop();
        voices.delete(id);
      }
      held.clear();
    },
    cancel() {
      for (const voice of voices.values()) voice.stop();
      voices.clear();
      held.clear();
    },
    releaseInstrument(_instrument: Instrument) {
      this.cancel();
    },
    dispose() {
      this.cancel();
      void context?.close();
      context = null;
      destination = null;
    },
  };
}
export type Engine = ReturnType<typeof createEngine>;
