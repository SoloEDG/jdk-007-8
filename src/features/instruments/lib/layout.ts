export const pads = [
  { pitch: 0, name: "底鼓", key: "Q", detail: "KICK 808", color: "#d5f377" },
  { pitch: 1, name: "军鼓", key: "W", detail: "SNARE", color: "#e5b4ff" },
  { pitch: 2, name: "踩镲", key: "E", detail: "CLOSED HAT", color: "#9fc8ff" },
  { pitch: 3, name: "开镲", key: "R", detail: "OPEN HAT", color: "#f7bd8b" },
];
export const keys = [
  { pitch: 60, key: "A", name: "C" },
  { pitch: 62, key: "S", name: "D" },
  { pitch: 64, key: "D", name: "E" },
  { pitch: 65, key: "F", name: "F" },
  { pitch: 67, key: "G", name: "G" },
  { pitch: 69, key: "H", name: "A" },
  { pitch: 71, key: "J", name: "B" },
  { pitch: 72, key: "K", name: "C" },
];
export function keyboardNote(key: string) {
  const k = key.toUpperCase();
  const pad = pads.find((p) => p.key === k);
  if (pad) return { pitch: pad.pitch, instrument: "drums" as const };
  const note = keys.find((p) => p.key === k);
  return note ? { pitch: note.pitch, instrument: "keys" as const } : null;
}
