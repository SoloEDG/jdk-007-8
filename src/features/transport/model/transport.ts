import { clamp } from "@/shared/math";
import { clockBeat, loopPosition } from "../lib/timing";
export function createTransport() {
  let bpm = 108,
    beats = 16,
    running = false,
    anchor = 0,
    offset = 0,
    cursor = 0;
  const absolute = (now: number) =>
    running ? clockBeat(now, anchor, offset, bpm) : offset;
  return {
    view(now: number) {
      const abs = absolute(now);
      return {
        bpm,
        beats,
        running,
        absolute: abs,
        position: loopPosition(abs, beats),
      };
    },
    start(now: number) {
      if (running) return;
      anchor = now;
      cursor = offset;
      running = true;
    },
    pause(now: number) {
      offset = absolute(now);
      running = false;
      cursor = offset;
    },
    stop() {
      running = false;
      offset = 0;
      cursor = 0;
    },
    configure(tempo: number, length: number) {
      this.stop();
      bpm = clamp(Math.round(tempo), 40, 220);
      beats = [4, 8, 16, 32].includes(length) ? length : 16;
    },
    window(now: number, ceiling = Infinity) {
      if (!running) return null;
      const abs = absolute(now);
      // Keep a short late window so a transaction committed at a loop boundary
      // can still schedule its first note; discard long background backlog.
      const from = Math.max(cursor, abs - (0.1 * bpm) / 60);
      const to = Math.min(ceiling, abs + (0.075 * bpm) / 60);
      if (to <= from) return null;
      cursor = to;
      return {
        from,
        to,
        timeAt: (beat: number) => anchor + ((beat - offset) * 60) / bpm,
      };
    },
  };
}
export type Transport = ReturnType<typeof createTransport>;
