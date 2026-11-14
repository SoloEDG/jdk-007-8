import type { Transport } from "../model/transport";
export function TransportBar({
  view,
  play,
  pause,
  stop,
  configure,
  disabled,
}: {
  view: ReturnType<Transport["view"]>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  configure: (bpm: number, beats: number) => void;
  disabled: boolean;
}) {
  return (
    <section className="transport">
      <div className="transport-buttons">
        <button
          className={`play ${view.running ? "on" : ""}`}
          onClick={view.running ? pause : play}
          aria-label={view.running ? "暂停" : "播放"}
        >
          {view.running ? "Ⅱ" : "▶"}
        </button>
        <button onClick={stop} aria-label="停止并回到起点">
          ■
        </button>
        <span className="transport-word">
          {view.running ? "正在播放" : "准备就绪"}
        </span>
      </div>
      <div className="tempo">
        <label>
          速度 <span>BPM</span>
          <input
            aria-label="速度 BPM"
            type="number"
            min="40"
            max="220"
            value={view.bpm}
            disabled={disabled}
            onChange={(e) => configure(Number(e.target.value), view.beats)}
          />
        </label>
      </div>
      <div className="loop-control">
        <label>
          循环长度
          <select
            aria-label="循环长度"
            value={view.beats}
            disabled={disabled}
            onChange={(e) => configure(view.bpm, Number(e.target.value))}
          >
            {[4, 8, 16, 32].map((n) => (
              <option key={n} value={n}>
                {n / 4} 小节
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="position">
        <strong>
          {String(Math.floor(view.position / 4) + 1).padStart(2, "0")}
          <i>.</i>
          {Math.floor(view.position % 4) + 1}
          <i>.</i>
          {String(Math.floor((view.position % 1) * 100)).padStart(2, "0")}
        </strong>
        <small>小节 · 拍 · 步</small>
      </div>
    </section>
  );
}
