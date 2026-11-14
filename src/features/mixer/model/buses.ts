import type { Channel } from "@/shared/types";
export function createBuses() {
  let ctx: AudioContext | null = null,
    master: GainNode | null = null;
  const channels = new Map<string, GainNode>();
  const apply = (node: GainNode, value: number) => {
    if (!ctx) return;
    node.gain.cancelScheduledValues(ctx.currentTime);
    node.gain.setValueAtTime(value, ctx.currentTime);
  };
  return {
    attach(context: AudioContext) {
      if (ctx === context) return;
      ctx = context;
      master = context.createGain();
      master.connect(context.destination);
    },
    sync(states: Readonly<Record<string, Channel>>, volume: number) {
      if (!ctx || !master) return;
      apply(master, volume);
      for (const id of channels.keys())
        if (!states[id]) {
          channels.get(id)?.disconnect();
          channels.delete(id);
        }
      for (const [id, state] of Object.entries(states)) {
        let bus = channels.get(id);
        if (!bus) {
          bus = ctx.createGain();
          bus.connect(master);
          channels.set(id, bus);
        }
        apply(bus, state.muted ? 0 : state.volume);
      }
    },
    channel(id: string) {
      const bus = channels.get(id);
      if (!bus) throw new Error("声道未初始化");
      return bus;
    },
    dispose() {
      for (const bus of channels.values()) bus.disconnect();
      channels.clear();
      master?.disconnect();
      master = null;
      ctx = null;
    },
  };
}
