import type { Track, ScheduledNote } from "@/shared/types";
import { occurrences } from "../lib/timing";
export function scheduleWindow(
  tracks: readonly Track[],
  from: number,
  to: number,
  beats: number,
  bpm: number,
  timeAt: (beat: number) => number,
  play: (note: ScheduledNote) => void,
) {
  for (const track of tracks)
    for (const note of track.notes)
      for (const beat of occurrences(note.beat, from, to, beats))
        play({
          trackId: track.id,
          instrument: track.instrument,
          pitch: note.pitch,
          velocity: note.velocity,
          duration: (note.duration * 60) / bpm,
          when: timeAt(beat),
        });
}
