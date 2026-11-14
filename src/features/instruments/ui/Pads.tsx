import type { NoteInput } from "@/shared/types";
import { pads } from "../lib/layout";
export function Pads({
  active,
  down,
  up,
}: {
  active: ReadonlySet<string>;
  down: (id: string, note: NoteInput) => void;
  up: (id: string) => void;
}) {
  return (
    <div className="pads">
      {pads.map((p) => {
        const id = `pad:${p.pitch}`;
        return (
          <button
            key={p.pitch}
            className={`pad ${active.has(id) || active.has(`key:Key${p.key}`) ? "pressed" : ""}`}
            style={{ "--pad": p.color } as React.CSSProperties}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              down(id, { pitch: p.pitch, instrument: "drums", velocity: 0.85 });
            }}
            onPointerUp={() => up(id)}
            onPointerCancel={() => up(id)}
            onLostPointerCapture={() => up(id)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !e.repeat)
                down(id, {
                  pitch: p.pitch,
                  instrument: "drums",
                  velocity: 0.85,
                });
            }}
            onKeyUp={() => up(id)}
            aria-label={`${p.name} ${p.key}`}
          >
            <kbd>{p.key}</kbd>
            <span className="pad-symbol">{["◉", "◈", "✳", "✷"][p.pitch]}</span>
            <strong>{p.name}</strong>
            <small>{p.detail}</small>
          </button>
        );
      })}
    </div>
  );
}
