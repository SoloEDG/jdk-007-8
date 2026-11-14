export type Instrument = "drums" | "keys";
export type Note = {
  id: string;
  pitch: number;
  beat: number;
  duration: number;
  velocity: number;
};
export type Track = {
  id: string;
  name: string;
  instrument: Instrument;
  color: string;
  notes: Note[];
};
export type Channel = { volume: number; muted: boolean };
/** 跟随风格：决定低音与鼓组的生成密度。 */
export type FollowStyle = "steady" | "groove" | "sparse";
/** 调性范围：约束候选和弦与低音音高。 */
export type FollowKeyRange = "open" | "bright" | "warm";
export type FollowSettings = {
  style: FollowStyle;
  keyRange: FollowKeyRange;
  bassTrackId: string | null;
  drumTrackId: string | null;
};
/** 识别候选：先展示，连续稳定若干拍后才在拍点切换。 */
export type FollowCandidate = {
  label: string;
  confidence: number;
  stable: boolean;
};
export type FollowState =
  | "off"
  | "requesting"
  | "listening"
  | "recovering"
  | "error";
export type FollowView = {
  state: FollowState;
  candidate: FollowCandidate | null;
  activeChord: string | null;
  /** 分析时钟相对播放拍钟的偏移（毫秒），用于校准展示。 */
  clockSkewMs: number;
  /** 麦克风输入电平 0..1，仅作监听指示，不落盘。 */
  inputLevel: number;
  micListening: boolean;
  error: string | null;
};
export type Session = {
  version: 1;
  title: string;
  bpm: number;
  beats: number;
  tracks: Track[];
  channels: Record<string, Channel>;
  master: number;
  follow?: FollowSettings | null;
};
export type NoteInput = {
  pitch: number;
  velocity: number;
  instrument: Instrument;
};
export type ScheduledNote = NoteInput & {
  duration: number;
  when: number;
  trackId: string;
};
export type Listener = () => void;
