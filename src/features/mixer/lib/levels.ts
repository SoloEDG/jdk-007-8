import { clamp } from "@/shared/math";
export const level = (value: number) =>
  clamp(Number.isFinite(value) ? value : 0, 0, 1);
export const decibels = (value: number) =>
  value <= 0 ? "−∞" : `${Math.round(20 * Math.log10(value))} dB`;
