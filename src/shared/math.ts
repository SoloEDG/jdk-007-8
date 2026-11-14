export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export const wrap = (n: number, length: number) =>
  ((n % length) + length) % length;
export const uid = () => crypto.randomUUID();
export const beatLabel = (beat: number) =>
  `${Math.floor(beat / 4) + 1}.${Math.floor(beat % 4) + 1}`;
