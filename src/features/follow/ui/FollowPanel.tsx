import type { FollowModel } from "../model/follow";
import type { Track, FollowStyle, FollowKeyRange } from "@/shared/types";
const STYLE_LABELS: Record<FollowStyle, string> = {
  steady: "稳健",
  groove: "律动",
  sparse: "留白",
};
const RANGE_LABELS: Record<FollowKeyRange, string> = {
  open: "不限",
  bright: "明亮",
  warm: "温暖",
};
const STATE_LABEL: Record<string, string> = {
  off: "未开启",
  requesting: "请求麦克风…",
  listening: "跟随中",
  recovering: "保持/淡出",
  error: "出错",
};
export function FollowPanel({
  view,
  tracks,
  onEnable,
  onDisable,
  onRecord,
  onStopRecord,
  setStyle,
  setKeyRange,
  setTarget,
}: {
  view: ReturnType<FollowModel["snapshot"]>;
  tracks: readonly Track[];
  onEnable: () => void;
  onDisable: () => void;
  onRecord: () => void;
  onStopRecord: () => void;
  setStyle: (s: FollowStyle) => void;
  setKeyRange: (r: FollowKeyRange) => void;
  setTarget: (kind: "bass" | "drums", id: string | null) => void;
}) {
  const on = view.micListening,
    locked = view.capture.armed;
  const bassTracks = tracks.filter((t) => t.instrument === "keys"),
    drumTracks = tracks.filter((t) => t.instrument === "drums");
  return (
    <section className="panel follow-panel">
      <div className="section-heading">
        <div>
          <small>03 / FOLLOW</small>
          <h2>
            跟随伴奏
            <span>{on ? STATE_LABEL[view.state] : "MIC ONLY FOR ANALYSIS"}</span>
          </h2>
        </div>
        <label className="follow-switch">
          <input
            type="checkbox"
            checked={on}
            onChange={on ? onDisable : onEnable}
          />
          <span className={on ? "lit" : ""}>{on ? "开" : "关"}</span>
        </label>
      </div>

      {view.state === "error" && view.error ? (
        <p className="follow-error" role="alert">
          {view.error}
        </p>
      ) : (
        <p className="follow-hint">
          麦克风仅用于识别，不接输出、不入作品，避免回授与回灌。
        </p>
      )}

      <div className={`follow-readout ${on ? "on" : ""}`}>
        <div className="chord-box">
          <small>候选和弦 CANDIDATE</small>
          <strong>{view.candidate ? view.candidate.label : "—"}</strong>
          <em className={view.candidate?.stable ? "stable" : ""}>
            {view.candidate
              ? view.candidate.stable
                ? "已稳定 · 下一小节切换"
                : "观察中"
              : "等待输入"}
          </em>
        </div>
        <div className="chord-box">
          <small>当前伴奏 ACTIVE</small>
          <strong>{view.activeChord ?? "—"}</strong>
          <em>{view.state === "recovering" ? "保持上一和弦" : STATE_LABEL[view.state]}</em>
        </div>
      </div>

      <div className="follow-meters">
        <label>
          <span>输入电平</span>
          <div className="meter">
            <i style={{ width: `${Math.min(100, view.inputLevel * 260)}%` }} />
          </div>
        </label>
        <label>
          <span>时钟校准</span>
          <b>{on ? `${view.clockSkewMs.toFixed(1)} ms` : "—"}</b>
        </label>
        <label>
          <span>置信度</span>
          <b>{view.candidate ? `${Math.round(view.candidate.confidence * 100)}%` : "—"}</b>
        </label>
      </div>

      <div className="follow-settings">
        <label>
          <span>跟随风格</span>
          <div className="seg">
            {(Object.keys(STYLE_LABELS) as FollowStyle[]).map((s) => (
              <button
                key={s}
                className={view.settings.style === s ? "selected" : ""}
                onClick={() => setStyle(s)}
              >
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>
        </label>
        <label>
          <span>调性范围</span>
          <div className="seg">
            {(Object.keys(RANGE_LABELS) as FollowKeyRange[]).map((r) => (
              <button
                key={r}
                className={view.settings.keyRange === r ? "selected" : ""}
                onClick={() => setKeyRange(r)}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </label>
        <label className="target-row">
          <span>低音目标轨</span>
          <select
            value={view.settings.bassTrackId ?? ""}
            disabled={locked || bassTracks.length === 0}
            onChange={(e) => setTarget("bass", e.target.value || null)}
          >
            <option value="">自动 / 不指定</option>
            {bassTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="target-row">
          <span>鼓组目标轨</span>
          <select
            value={view.settings.drumTrackId ?? ""}
            disabled={locked || drumTracks.length === 0}
            onChange={(e) => setTarget("drums", e.target.value || null)}
          >
            <option value="">自动 / 不指定</option>
            {drumTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="follow-record">
        {locked ? (
          <button className="record recording" onClick={onStopRecord}>
            <span />
            结束跟随录音 · 已写入 {view.capture.pending} 个待提交音符
          </button>
        ) : (
          <button className="record" disabled={!on} onClick={onRecord}>
            <span />
            录制生成的伴奏
          </button>
        )}
        <small>
          仅记录实际生成并播放的低音/鼓点；取消或关跟随会丢弃未提交片段，旧片段保留。
        </small>
      </div>
    </section>
  );
}
