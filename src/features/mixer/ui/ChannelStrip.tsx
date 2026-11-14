import type { Channel, Track } from "@/shared/types";
import { decibels } from "../lib/levels";
export function ChannelStrip({
  track,
  channel,
  volume,
  mute,
  running,
}: {
  track: Track;
  channel: Channel;
  volume: (n: number) => void;
  mute: () => void;
  running: boolean;
}) {
  return (
    <div className={`channel-strip ${channel.muted ? "muted" : ""}`}>
      <div className="strip-head">
        <span className="color-dot" style={{ background: track.color }} />
        <strong>{track.name}</strong>
        <button
          onClick={mute}
          aria-label={`${channel.muted ? "取消静音" : "静音"} ${track.name}`}
          aria-pressed={channel.muted}
        >
          M
        </button>
      </div>
      <div className="fader-line">
        <input
          aria-label={`${track.name} 音量`}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={channel.volume}
          onChange={(e) => volume(Number(e.target.value))}
        />
        <span>{decibels(channel.muted ? 0 : channel.volume)}</span>
      </div>
      <div className="level-track">
        <i
          style={{
            width: `${running && !channel.muted ? channel.volume * 100 : 0}%`,
            background: track.color,
          }}
        />
      </div>
    </div>
  );
}
