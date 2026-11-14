import type { Instrument, Track } from "@/shared/types";
export function TrackActions({
  selected,
  count,
  locked,
  add,
  remove,
  clear,
}: {
  selected: Track | null;
  count: number;
  locked: boolean;
  add: (kind: Instrument) => void;
  remove: () => void;
  clear: () => void;
}) {
  return (
    <div className="track-actions">
      <button disabled={locked || count >= 8} onClick={() => add("drums")}>
        ＋ 鼓组轨道
      </button>
      <button disabled={locked || count >= 8} onClick={() => add("keys")}>
        ＋ 琴键轨道
      </button>
      <span>{count} / 8 轨道</span>
      <button
        disabled={locked || !selected || !selected.notes.length}
        onClick={clear}
      >
        清空音符
      </button>
      <button
        disabled={locked || !selected}
        onClick={remove}
        aria-label="删除选中轨道"
      >
        删除轨道
      </button>
    </div>
  );
}
