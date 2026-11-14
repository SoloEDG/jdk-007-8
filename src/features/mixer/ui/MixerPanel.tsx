import type { Track, Channel } from "@/shared/types";
import { ChannelStrip } from "./ChannelStrip";
export function MixerPanel({
  tracks,
  channels,
  master,
  running,
  volume,
  mute,
  setMaster,
}: {
  tracks: readonly Track[];
  channels: Record<string, Channel>;
  master: number;
  running: boolean;
  volume: (id: string, n: number) => void;
  mute: (id: string) => void;
  setMaster: (n: number) => void;
}) {
  return (
    <section className="panel mixer-panel">
      <div className="section-heading">
        <div>
          <small>03 / BALANCE</small>
          <h2>混音台</h2>
        </div>
        <span className="tag">LIVE BUS</span>
      </div>
      {tracks.length === 0 ? (
        <p className="empty-small">添加轨道后，在这里平衡每一种声音。</p>
      ) : (
        tracks.map((t) => (
          <ChannelStrip
            key={t.id}
            track={t}
            channel={channels[t.id] ?? { volume: 0.75, muted: false }}
            running={running}
            volume={(n) => volume(t.id, n)}
            mute={() => mute(t.id)}
          />
        ))
      )}
      <div className="master">
        <div>
          <strong>主输出</strong>
          <span>{Math.round(master * 100)}%</span>
        </div>
        <input
          aria-label="主音量"
          type="range"
          min="0"
          max="1"
          step=".01"
          value={master}
          onChange={(e) => setMaster(Number(e.target.value))}
        />
        <small>电平条为设定值 · 声音由本机实时合成</small>
      </div>
    </section>
  );
}
