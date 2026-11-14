import type { Recorder } from "../model/recorder";
export function RecordControls({
  state,
  canRecord,
  record,
  cancel,
  setGrid,
}: {
  state: ReturnType<Recorder["snapshot"]>;
  canRecord: boolean;
  record: () => void;
  cancel: () => void;
  setGrid: (n: number) => void;
}) {
  return (
    <div className="record-controls">
      <button
        className={`record ${state.status !== "idle" ? "recording" : ""}`}
        disabled={!canRecord && state.status === "idle"}
        onClick={state.status === "idle" ? record : cancel}
      >
        <span />
        {state.status === "idle" ? "录制循环" : "取消本次录制"}
      </button>
      <label>
        吸附
        <select
          aria-label="录音吸附"
          value={state.grid}
          disabled={state.status !== "idle"}
          onChange={(e) => setGrid(Number(e.target.value))}
        >
          <option value="0.25">1/16 音符</option>
          <option value="0.5">1/8 音符</option>
          <option value="1">1/4 音符</option>
        </select>
      </label>
    </div>
  );
}
