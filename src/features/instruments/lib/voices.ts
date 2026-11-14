import type { ScheduledNote } from "@/shared/types";
export type Voice = { stop: () => void; end: number };
export function synthesize(
  ctx: AudioContext,
  output: AudioNode,
  note: ScheduledNote,
): Voice {
  const when = Math.max(ctx.currentTime, note.when);
  const gain = ctx.createGain();
  gain.connect(output);
  const sources: AudioScheduledSourceNode[] = [];
  let length = note.duration;
  const amp = Math.max(0.001, note.velocity) * 0.35;
  if (note.instrument === "drums") {
    length = note.pitch === 0 ? 0.38 : note.pitch === 1 ? 0.22 : 0.12;
    if (note.pitch === 0) {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(145, when);
      osc.frequency.exponentialRampToValueAtTime(42, when + 0.18);
      osc.connect(gain);
      sources.push(osc);
    } else {
      const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * length),
        ctx.sampleRate,
      );
      const d = buffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = note.pitch === 1 ? 1000 : 6500;
      source.connect(filter);
      filter.connect(gain);
      sources.push(source);
    }
  } else {
    length = Math.max(0.08, note.duration);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 440 * 2 ** ((note.pitch - 69) / 12);
    osc.connect(gain);
    sources.push(osc);
  }
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(amp, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const s of sources) {
      try {
        s.stop();
      } catch {}
    }
    gain.disconnect();
  };
  let ended = 0;
  for (const source of sources) {
    source.onended = () => {
      ended++;
      if (ended === sources.length) {
        gain.disconnect();
        stopped = true;
      }
    };
    source.start(when);
    source.stop(when + length + 0.02);
  }
  return { stop, end: when + length + 0.02 };
}
