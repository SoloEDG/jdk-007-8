import type { NoteInput } from "@/shared/types";
import { keyboardNote } from "../lib/layout";
export function bindPerformanceInput(
  down: (id: string, note: NoteInput) => void,
  up: (id: string) => void,
) {
  const pressed = new Set<string>();
  const onDown = (e: KeyboardEvent) => {
    if (
      e.repeat ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)
    )
      return;
    const note = keyboardNote(e.key);
    if (!note) return;
    e.preventDefault();
    const id = "key:" + e.code;
    if (pressed.has(id)) return;
    pressed.add(id);
    down(id, { ...note, velocity: 0.8 });
  };
  const onUp = (e: KeyboardEvent) => {
    const id = "key:" + e.code;
    if (pressed.delete(id)) up(id);
  };
  const blur = () => {
    for (const id of pressed) up(id);
    pressed.clear();
  };
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", blur);
  return () => {
    blur();
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", blur);
  };
}
