import type { Recorder } from "../model/recorder";
export function RecordingStatus({
  state,
  absolute,
}: {
  state: ReturnType<Recorder["snapshot"]>;
  absolute: number;
}) {
  if (state.status === "idle")
    return (
      <p className="record-hint">
        从下一个循环起点录制一整圈 · 完成后替换选中轨道 · 取消保留原录音
      </p>
    );
  return (
    <div className="record-status" role="status">
      <span className="red-dot" />
      {state.status === "waiting"
        ? `等待循环起点 · 还有 ${Math.max(0, state.start - absolute).toFixed(1)} 拍`
        : `正在录制 · ${Math.max(0, state.start + state.length - absolute).toFixed(1)} 拍后完成`}
      <progress
        max={state.length}
        value={Math.max(0, absolute - state.start)}
      />
    </div>
  );
}
