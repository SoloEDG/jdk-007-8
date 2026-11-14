import { createEngine, bindPerformanceInput } from "@/features/instruments";
import { createTransport, scheduleWindow } from "@/features/transport";
import { createRecorder } from "@/features/recorder";
import {
  createArrangement,
  demoSession,
  saveSession,
  loadSession,
} from "@/features/arrangement";
import { createMixer } from "@/features/mixer";
import { createFollowModel } from "@/features/follow";
import type {
  NoteInput,
  Instrument,
  Session,
  FollowSettings,
  FollowStyle,
  FollowKeyRange,
} from "@/shared/types";
const DEFAULT_FOLLOW: FollowSettings = {
  style: "groove",
  keyRange: "open",
  bassTrackId: null,
  drumTrackId: null,
};
export function createStudio(notify: () => void) {
  const engine = createEngine(),
    transport = createTransport(),
    recorder = createRecorder(),
    arrangement = createArrangement(),
    mixer = createMixer();
  let followSettings: FollowSettings = { ...DEFAULT_FOLLOW };
  let message = "欢迎来到夜航。戴上耳机，试着敲下第一拍。";
  const follow = createFollowModel({
    clock: () => engine.context?.currentTime ?? 0,
    transport,
    play: (n) => engine.play(n),
    getSettings: () => followSettings,
    onTake: (take) => {
      // 保存的是实际生成并播放过的伴奏音符。
      arrangement.commit(take.trackId, take.notes);
      const track = arrangement.snapshot().tracks.find(
        (t) => t.id === take.trackId,
      );
      message = `跟随录音已提交到 ${track?.name ?? "目标轨"} · ${take.notes.length} 个音符`;
      notify();
    },
  });
  const active = new Set<string>();
  let epoch = 0,
    disposed = false;
  const now = () => engine.context?.currentTime ?? 0;
  const feedback = (text: string) => {
    message = text;
    notify();
  };
  const guard = (fn: () => void) => {
    try {
      fn();
      notify();
    } catch (error) {
      feedback(
        error instanceof Error ? error.message : "操作失败，现有作品已保留",
      );
    }
  };
  const syncMixer = () =>
    mixer.ensure(arrangement.snapshot().tracks.map((t) => t.id));
  const cancelVoices = () => {
    engine.cancel();
    active.clear();
  };
  const stop = () => {
    epoch++;
    transport.stop();
    recorder.cancel();
    follow.reset();
    cancelVoices();
    notify();
  };
  const pause = () => {
    epoch++;
    transport.pause(now());
    recorder.cancel();
    follow.reset();
    cancelVoices();
    feedback("播放已暂停；未完成录音已取消，原片段保留。");
  };
  const unlock = async () => {
    const context = await engine.unlock();
    if (disposed) return false;
    mixer.attach(context);
    syncMixer();
    engine.route(mixer.channel);
    return true;
  };
  const play = async () => {
    const token = ++epoch;
    try {
      if (!(await unlock()) || token !== epoch) return;
      transport.start(now() + 0.02);
      tick();
      notify();
    } catch {
      feedback("声音启动失败，请再次点击播放");
    }
  };
  const tick = () => {
    const time = now(),
      view = transport.view(time);
    const take = recorder.advance(view.absolute);
    if (take)
      guard(() => {
        arrangement.commit(take.trackId, take.notes);
        message = `录制完成 · ${take.notes.length} 个音符`;
      });
    follow.tick();
    const capture = recorder.snapshot();
    const ceiling =
      capture.status === "idle" ? Infinity : capture.start + capture.length;
    const window = transport.window(time, ceiling);
    if (window)
      scheduleWindow(
        arrangement.forPlayback(),
        window.from,
        window.to,
        view.beats,
        view.bpm,
        window.timeAt,
        (n) => engine.play(n),
      );
  };
  const down = async (id: string, note: NoteInput) => {
    if (active.has(id)) return;
    active.add(id);
    notify();
    try {
      if (!(await unlock()) || !active.has(id)) return;
      const target = arrangement.selected();
      if (!target || target.instrument !== note.instrument) {
        active.delete(id);
        feedback("请先选择对应乐器的轨道");
        return;
      }
      const abs = transport.view(now()).absolute;
      const take = recorder.advance(abs);
      if (take) arrangement.commit(take.trackId, take.notes);
      recorder.down(id, note, abs);
      engine.play(
        {
          ...note,
          trackId: target.id,
          duration: note.instrument === "keys" ? 6 : 0.3,
          when: now(),
        },
        id,
      );
    } catch {
      active.delete(id);
      feedback("请点击播放以启用声音");
    }
  };
  const up = (id: string) => {
    if (!active.delete(id)) return;
    recorder.up(id, transport.view(now()).absolute);
    engine.release(id);
    notify();
  };
  const install = (session: Session) => {
    stop();
    const valid = arrangement.restore(session);
    transport.configure(valid.bpm, valid.beats);
    mixer.restore(valid.channels, valid.master);
    followSettings = valid.follow
      ? { ...valid.follow }
      : { ...DEFAULT_FOLLOW };
    notify();
  };
  const timer = window.setInterval(() => {
    tick();
    notify();
  }, 20);
  const unbind = bindPerformanceInput((id, note) => void down(id, note), up);
  const shortcut = (e: KeyboardEvent) => {
    if (
      e.code === "Space" &&
      !e.repeat &&
      !/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target as HTMLElement).tagName)
    ) {
      e.preventDefault();
      if (transport.view(now()).running) pause();
      else void play();
    }
  };
  const blur = () => {
    for (const id of [...active]) up(id);
  };
  window.addEventListener("keydown", shortcut);
  window.addEventListener("blur", blur);
  return {
    view() {
      return {
        transport: transport.view(now()),
        arrangement: arrangement.snapshot(),
        selected: arrangement.selected(),
        recorder: recorder.snapshot(),
        mixer: mixer.snapshot(),
        follow: follow.snapshot(),
        active: new Set(active),
        message,
      };
    },
    play,
    pause,
    stop,
    down: (id: string, n: NoteInput) => void down(id, n),
    up,
    configure(bpm: number, beats: number) {
      if (follow.isCapturing()) {
        feedback("跟随录音尚未提交，请先结束跟随录音再改速度或长度");
        return;
      }
      stop();
      transport.configure(bpm, beats);
      arrangement.resizeLoop(transport.view(now()).beats);
      feedback("速度或长度变更：播放回到起点；缩短时移除范围外音符。");
    },
    add(kind: Instrument) {
      guard(() => {
        if (follow.isCapturing())
          throw new Error("跟随录音尚未提交，请等这一圈写完后再加轨道");
        arrangement.add(kind);
        syncMixer();
      });
    },
    select(id: string) {
      if (recorder.snapshot().status !== "idle") return;
      if (follow.isCapturing()) return;
      engine.releaseHeld();
      active.clear();
      arrangement.select(id);
      notify();
    },
    remove() {
      guard(() => {
        const selected = arrangement.selected();
        if (selected) {
          if (
            followSettings.bassTrackId === selected.id ||
            followSettings.drumTrackId === selected.id
          )
            throw new Error("该轨道是跟随伴奏的目标轨，请先更换目标轨");
          stop();
          arrangement.remove(selected.id);
          syncMixer();
        }
      });
    },
    clear() {
      guard(() => {
        const t = arrangement.selected();
        if (t) {
          stop();
          arrangement.clear(t.id);
        }
      });
    },
    async record() {
      const selected = arrangement.selected();
      if (!selected) return;
      const token = ++epoch;
      try {
        if (!(await unlock()) || token !== epoch) return;
        const state = transport.view(now());
        if (!state.running) transport.start(now() + 0.02);
        recorder.arm(
          selected.id,
          selected.instrument,
          transport.view(now()).absolute,
          state.beats,
        );
        tick();
        notify();
      } catch {
        feedback("录音启动失败，请重试");
      }
    },
    cancel() {
      recorder.cancel();
      feedback("本次录音已取消，之前的片段仍然保留。");
    },
    grid(n: number) {
      recorder.grid(n);
      notify();
    },
    volume(id: string, n: number) {
      mixer.volume(id, n);
      notify();
    },
    mute(id: string) {
      mixer.mute(id);
      notify();
    },
    master(n: number) {
      mixer.master(n);
      notify();
    },
    demo() {
      guard(() => {
        install(demoSession());
        message = "示范已载入 · 点击播放，听听凌晨两点。";
      });
    },
    save() {
      guard(() => {
        if (recorder.snapshot().status !== "idle")
          throw new Error("请完成或取消录音后再保存");
        if (follow.isCapturing())
          throw new Error("跟随录音正在写入，请等这一圈提交后再保存");
        const a = arrangement.snapshot(),
          t = transport.view(now()),
          m = mixer.snapshot();
        saveSession({
          version: 1,
          title: a.title,
          bpm: t.bpm,
          beats: t.beats,
          tracks: a.tracks,
          channels: m.channels,
          master: m.master,
          follow: { ...followSettings },
        });
        message = "作品已保存到本机浏览器（含跟随风格、调性与目标轨）";
      });
    },
    load() {
      guard(() => {
        const session = loadSession();
        install(session);
        message =
          "本地作品已恢复（暂停状态）；开启跟随伴奏需再次授权麦克风";
      });
    },
    async enableFollow() {
      const token = ++epoch;
      try {
        if (!(await unlock()) || token !== epoch) return;
        await follow.enable();
        if (token !== epoch) return;
        const snap = follow.snapshot();
        if (snap.state === "error") {
          message = snap.error ?? "跟随伴奏启动失败";
          notify();
          return;
        }
        // 自动准备独立的低音（琴键）与鼓组轨道，并接好混音声道。
        try {
          const hasTrack = (id: string | null) =>
            !!id && arrangement.snapshot().tracks.some((t) => t.id === id);
          if (!hasTrack(followSettings.bassTrackId)) {
            const bassId = arrangement.add("keys", "跟随低音");
            followSettings = { ...followSettings, bassTrackId: bassId };
          }
          if (!hasTrack(followSettings.drumTrackId)) {
            const drumId = arrangement.add("drums", "跟随鼓组");
            followSettings = { ...followSettings, drumTrackId: drumId };
          }
        } catch (trackError) {
          follow.disable();
          throw trackError;
        }
        syncMixer();
        message = "跟随伴奏已开启：麦克风只用于分析，不监听也不入作品";
        notify();
      } catch {
        feedback("跟随伴奏启动失败，请检查麦克风权限");
      }
    },
    disableFollow() {
      const wasArmed = follow.disable();
      message = wasArmed
        ? "跟随伴奏已关闭：未提交的生成录音已取消，旧片段保留；已提交的伴奏可原样回放"
        : "跟随伴奏已关闭：已提交的伴奏仍可随循环原样回放";
      notify();
    },
    recordFollow() {
      guard(() => {
        follow.armCapture();
        message =
          "跟随录音已待命：从下一个整循环开始记录实际生成的低音与鼓点";
      });
    },
    stopRecordFollow() {
      const wasArmed = follow.stopCapture();
      message = wasArmed
        ? "跟随录音已结束：已提交的整圈伴奏保留，未写完的片段已丢弃"
        : message;
      notify();
    },
    setFollowStyle(style: FollowStyle) {
      followSettings = { ...followSettings, style };
      notify();
    },
    setFollowKeyRange(keyRange: FollowKeyRange) {
      followSettings = { ...followSettings, keyRange };
      notify();
    },
    setFollowTarget(kind: "bass" | "drums", trackId: string | null) {
      guard(() => {
        if (!follow.canSwitchTarget())
          throw new Error("跟随录音尚未提交，请等这一圈写完后再换目标轨");
        const track = trackId
          ? arrangement.snapshot().tracks.find((t) => t.id === trackId)
          : null;
        if (trackId && !track) throw new Error("目标轨道不存在");
        if (
          track &&
          ((kind === "bass" && track.instrument !== "keys") ||
            (kind === "drums" && track.instrument !== "drums"))
        )
          throw new Error("目标轨乐器不匹配");
        followSettings =
          kind === "bass"
            ? { ...followSettings, bassTrackId: trackId }
            : { ...followSettings, drumTrackId: trackId };
        notify();
      });
    },
    dispose() {
      disposed = true;
      epoch++;
      clearInterval(timer);
      unbind();
      window.removeEventListener("keydown", shortcut);
      window.removeEventListener("blur", blur);
      follow.dispose();
      mixer.dispose();
      engine.dispose();
    },
  };
}
export type Studio = ReturnType<typeof createStudio>;
