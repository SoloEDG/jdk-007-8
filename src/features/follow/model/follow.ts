import type {
  FollowCandidate,
  FollowSettings,
  FollowState,
  FollowView,
  Note,
} from "@/shared/types";
import { uid, wrap, clamp } from "@/shared/math";
import { guessChord, snapToRange, type ChordGuess } from "../lib/chords";
import {
  bassBar,
  drumBar,
  withFade,
  type PatternNote,
} from "../lib/patterns";
import { createMicAnalyzer, type MicAnalyzer } from "../lib/analyzer";
const RMS_FLOOR = 0.012,
  VOTE_WINDOW = 12,
  STABLE_RATIO = 0.6,
  MIN_CONFIDENCE = 0.45,
  LOW_STREAK = 16,
  LOOKAHEAD_SECONDS = 0.12,
  BAR_BEATS = 4,
  REST_VOTE = "__rest__";
type PlannedChord = { root: number; label: string };
type BarPlan = {
  barIndex: number;
  bass: PatternNote[];
  drums: PatternNote[];
  fade: boolean;
};
export type FollowCapture = {
  armed: boolean;
  bassTrackId: string | null;
  drumTrackId: string | null;
  pending: number;
};
export type FollowTake = { trackId: string; notes: Note[] };
export type FollowSnapshot = FollowView & {
  settings: FollowSettings;
  capture: FollowCapture;
};
type Captured = { note: Note; trackId: string };
export function createFollowModel(deps: {
  clock: () => number;
  transport: {
    view: (now: number) => {
      running: boolean;
      absolute: number;
      bpm: number;
      beats: number;
    };
  };
  play: (note: {
    trackId: string;
    instrument: "keys" | "drums";
    pitch: number;
    velocity: number;
    duration: number;
    when: number;
  }) => void;
  onTake: (take: FollowTake) => void;
  getSettings: () => FollowSettings;
  makeAnalyzer?: () => MicAnalyzer;
  tuning?: { voteWindow?: number; lowStreak?: number };
}) {
  const voteWindow = deps.tuning?.voteWindow ?? VOTE_WINDOW,
    lowStreakLimit = deps.tuning?.lowStreak ?? LOW_STREAK;
  const mic: MicAnalyzer = deps.makeAnalyzer
    ? deps.makeAnalyzer()
    : createMicAnalyzer();
  let state: FollowState = "off",
    error: string | null = null;
  let candidate: FollowCandidate | null = null,
    committed: PlannedChord | null = null;
  let inputLevel = 0,
    lowStreak = 0;
  const votes: string[] = [];
  let guessByLabel = new Map<string, ChordGuess>();
  // 调度游标（绝对拍）与小节边界追踪。
  let scheduledUpTo = -Infinity,
    lastBar = -1,
    pendingHold = false,
    pendingFade = false,
    fadeBarIndex = -1;
  // 生成音符的整圈录音：对齐循环边界，一圈提交一次。
  let captureArmed = false,
    captureLoop = -1;
  let captured: Captured[] = [];
  const settings = () => deps.getSettings();
  const resetCursors = () => {
    scheduledUpTo = -Infinity;
    lastBar = -1;
    pendingHold = false;
    pendingFade = false;
    fadeBarIndex = -1;
    captureLoop = -1;
  };
  const stableLabel = (): string | null => {
    if (votes.length < voteWindow * 0.75) return null;
    const counts = new Map<string, number>();
    for (const label of votes)
      counts.set(label, (counts.get(label) ?? 0) + 1);
    let winner: string | null = null,
      best = 0;
    for (const [label, count] of counts)
      if (count > best) {
        best = count;
        winner = label;
      }
    return winner && best / votes.length >= STABLE_RATIO ? winner : null;
  };
  /**
   * 小节边界状态机：连续稳定的候选只在新一小节开始时切换和弦；
   * 置信度丢失则先保持一小节，再用一小节淡出，随后停止生成。
   */
  const onBarBoundary = (barIndex: number) => {
    if (fadeBarIndex >= 0 && barIndex > fadeBarIndex) {
      committed = null;
      pendingFade = false;
      pendingHold = false;
      fadeBarIndex = -1;
      votes.length = 0;
      state = "recovering";
      return;
    }
    const label = stableLabel();
    if (label && (!committed || committed.label !== label)) {
      const guess = guessByLabel.get(label);
      if (guess) {
        committed = { root: guess.root, label: guess.label };
        pendingHold = false;
        pendingFade = false;
        fadeBarIndex = -1;
        state = "listening";
      }
    }
  };
  const buildPlan = (barIndex: number): BarPlan => {
    if (!committed) return { barIndex, bass: [], drums: [], fade: false };
    let fade = false;
    if (pendingHold) {
      // 置信度丢失后的第一小节：原样保持上一和弦。
      pendingHold = false;
      pendingFade = true;
    } else if (pendingFade) {
      // 第二小节：同一骨架线性淡出。
      fade = true;
      pendingFade = false;
      fadeBarIndex = barIndex;
    }
    const bass = bassBar(committed.root, settings().style),
      drums = drumBar(settings().style);
    return {
      barIndex,
      bass: fade ? withFade(bass) : bass,
      drums: fade ? withFade(drums) : drums,
      fade,
    };
  };
  const flushCapture = () => {
    if (!captureArmed || captured.length === 0) {
      captured = [];
      return;
    }
    const groups = new Map<string, Note[]>();
    for (const { note, trackId } of captured) {
      const list = groups.get(trackId) ?? [];
      list.push(note);
      groups.set(trackId, list);
    }
    captured = [];
    for (const [trackId, notes] of groups)
      deps.onTake({ trackId, notes: notes.sort((a, b) => a.beat - b.beat) });
  };
  const schedule = () => {
    const now = deps.clock();
    const view = deps.transport.view(now);
    if (!view.running) return;
    const spb = 60 / view.bpm;
    const timeAt = (beat: number) => now + (beat - view.absolute) * spb;
    const threshold = view.absolute + LOOKAHEAD_SECONDS / spb;
    if (scheduledUpTo === -Infinity) scheduledUpTo = view.absolute;
    const currentBar = Math.floor(view.absolute / BAR_BEATS);
    if (lastBar === -1) lastBar = currentBar;
    if (currentBar !== lastBar) {
      lastBar = currentBar;
      onBarBoundary(currentBar);
    }
    const emit = (
      pattern: PatternNote,
      instrument: "keys" | "drums",
      barIndex: number,
    ) => {
      const absBeat = barIndex * BAR_BEATS + pattern.beat;
      if (absBeat <= scheduledUpTo || absBeat > threshold) return;
      const trackId =
        instrument === "keys"
          ? settings().bassTrackId
          : settings().drumTrackId;
      if (!trackId) return;
      deps.play({
        trackId,
        instrument,
        pitch: pattern.pitch,
        velocity: pattern.velocity,
        duration: (pattern.duration * 60) / view.bpm,
        when: Math.max(now, timeAt(absBeat)),
      });
      // 录音在 arm 时即锁定下一个整循环，保证一圈音符落在同一目标轨。
      if (captureArmed) {
        if (Math.floor(absBeat / view.beats) === captureLoop)
          captured.push({
            trackId,
            note: {
              id: uid(),
              pitch: pattern.pitch,
              beat: wrap(absBeat, view.beats),
              duration: pattern.duration,
              velocity: clamp(pattern.velocity, 0.05, 1),
            },
          });
      }
    };
    // 覆盖 lookahead 窗口触及的每个小节，避免小节边界丢音。
    const lastBarInWindow = Math.floor(threshold / BAR_BEATS);
    for (let barIndex = currentBar; barIndex <= lastBarInWindow; barIndex++) {
      const barPlan = buildPlan(barIndex);
      for (const p of barPlan.bass) emit(p, "keys", barIndex);
      for (const p of barPlan.drums) emit(p, "drums", barIndex);
    }
    if (captureArmed && captureLoop !== -1 && captured.length > 0) {
      const loop = Math.floor(view.absolute / view.beats);
      // 当前循环已越过目标录音循环，说明那一整圈已写完并可提交。
      if (loop > captureLoop) {
        flushCapture();
        captureLoop = loop;
      }
    }
    scheduledUpTo = Math.max(scheduledUpTo, threshold);
  };
  return {
    mic,
    snapshot: (): FollowSnapshot => ({
      state,
      candidate,
      activeChord: committed?.label ?? null,
      clockSkewMs: mic.active ? mic.skewMs : 0,
      inputLevel,
      micListening: mic.active,
      error,
      settings: settings(),
      capture: {
        armed: captureArmed,
        bassTrackId: settings().bassTrackId,
        drumTrackId: settings().drumTrackId,
        pending: captured.length,
      },
    }),
    async enable() {
      if (mic.active) return;
      state = "requesting";
      error = null;
      try {
        await mic.start(deps.clock);
        resetCursors();
        votes.length = 0;
        guessByLabel = new Map();
        lowStreak = 0;
        committed = null;
        candidate = null;
        captured = [];
        state = "listening";
      } catch (e) {
        state = "error";
        error =
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "麦克风权限被拒绝，跟随伴奏未开启"
            : "麦克风不可用，请检查设备后重试";
      }
    },
    /** 关闭跟随：取消未提交的生成录音，已提交的旧片段原样保留。 */
    disable() {
      const wasArmed = captureArmed;
      mic.stop();
      captureArmed = false;
      captured = [];
      resetCursors();
      committed = null;
      candidate = null;
      votes.length = 0;
      lowStreak = 0;
      state = "off";
      error = null;
      return wasArmed;
    },
    /** 传输停止/暂停时重置调度游标，但保留麦克风会话与识别状态。 */
    reset() {
      resetCursors();
    },
    tick() {
      if (!mic.active) return;
      const frame = mic.analyze();
      inputLevel = frame
        ? Math.max(frame.rms, inputLevel * 0.85)
        : inputLevel * 0.85;
      const view = deps.transport.view(deps.clock());
      if (!frame || !view.running) return;
      const audible = frame.rms >= RMS_FLOOR;
      let guess = audible
        ? guessChord(frame.chroma, settings().keyRange)
        : null;
      if (guess && guess.confidence >= MIN_CONFIDENCE) {
        lowStreak = 0;
        guess = { ...guess, root: snapToRange(guess.root, settings().keyRange) };
        guessByLabel.set(guess.label, guess);
        votes.push(guess.label);
        if (votes.length > voteWindow) votes.shift();
        candidate = {
          label: guess.label,
          confidence: guess.confidence,
          stable: stableLabel() === guess.label,
        };
      } else {
        lowStreak++;
        // 休止符投票：让旧和弦在稳定窗口内自然失效，避免静默后“复活”。
        votes.push(REST_VOTE);
        if (votes.length > voteWindow) votes.shift();
        if (candidate) candidate = { ...candidate, stable: false };
        if (lowStreak === lowStreakLimit && committed) {
          // 置信度持续不足：清空历史投票，防止旧和弦在淡出栏后被复活。
          votes.length = 0;
          // 先保持上一和弦一小节，再安排淡出栏；其他轨照常播放。
          pendingHold = true;
          state = "recovering";
        }
      }
      schedule();
    },
    armCapture() {
      if (!mic.active) throw new Error("请先开启跟随伴奏");
      const view = deps.transport.view(deps.clock());
      if (!view.running) throw new Error("请先开始播放再录制生成的伴奏");
      captureArmed = true;
      captured = [];
      // 立即锁定下一个整循环边界，避免初始循环音符被漏录。
      captureLoop = Math.floor(view.absolute / view.beats) + 1;
    },
    isCapturing: () => captureArmed,
    /** 结束录音：已提交的整圈片段保留，当前未写完的片段丢弃。 */
    stopCapture() {
      const wasArmed = captureArmed;
      captureArmed = false;
      captured = [];
      captureLoop = -1;
      return wasArmed;
    },
    /** 目标轨在录音未提交前锁定，避免一圈前后落到不同轨。 */
    canSwitchTarget: () => !captureArmed,
    dispose() {
      mic.stop();
      captureArmed = false;
      captured = [];
      state = "off";
    },
  };
}
export type FollowModel = ReturnType<typeof createFollowModel>;
