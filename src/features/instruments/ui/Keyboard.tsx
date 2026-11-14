import type { NoteInput } from "@/shared/types";
import { keys } from "../lib/layout";
export function Keyboard({
  active,
  down,
  up,
}: {
  active: ReadonlySet<string>;
  down: (id: string, note: NoteInput) => void;
  up: (id: string) => void;
}) {
  return (
    <div className="keyboard">
      {keys.map((k, i) => {
        const id = `piano:${k.pitch}`;
        return (
          <div className="key-wrap" key={k.pitch}>
            <button
              className={`white-key ${active.has(id) || active.has(`key:Key${k.key}`) ? "pressed" : ""}`}
              aria-label={`琴键 ${k.name} ${k.key}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                down(id, {
                  pitch: k.pitch,
                  instrument: "keys",
                  velocity: 0.65,
                });
              }}
              onPointerUp={() => up(id)}
              onPointerCancel={() => up(id)}
              onLostPointerCapture={() => up(id)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !e.repeat)
                  down(id, {
                    pitch: k.pitch,
                    instrument: "keys",
                    velocity: 0.65,
                  });
              }}
              onKeyUp={() => up(id)}
            >
              <span>{k.name}</span>
              <kbd>{k.key}</kbd>
            </button>
            {![2, 6, 7].includes(i) && (
              <span className="black-key" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
