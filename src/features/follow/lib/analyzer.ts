import { PITCH_CLASS_COUNT } from "./chords";
export type AnalysisFrame = {
  /** 已校准到播放 AudioContext 的时间（秒）。 */
  engineTime: number;
  rms: number;
  chroma: readonly number[];
  onset: boolean;
};
const FFT_SIZE = 4096,
  FIT_SAMPLES = 16;
/**
 * 分析时钟 → 播放时钟的最小二乘线性拟合：engine ≈ rate * analysis + offset。
 * 抽成纯函数便于验证校准精度；rate 反映两时钟漂移，offset 为固定偏置。
 */
export function fitClock(pairs: readonly { a: number; e: number }[]) {
  if (pairs.length < 2) return { rate: 1, offset: 0 };
  const n = pairs.length;
  let sa = 0,
    se = 0,
    saa = 0,
    sae = 0;
  for (const p of pairs) {
    sa += p.a;
    se += p.e;
    saa += p.a * p.a;
    sae += p.a * p.e;
  }
  const denom = n * saa - sa * sa;
  if (Math.abs(denom) < 1e-12) return { rate: 1, offset: 0 };
  const rate = (n * sae - sa * se) / denom;
  return { rate, offset: (se - rate * sa) / n };
}
/**
 * 麦克风分析器：输入只进 AnalyserNode，不连接 destination、不写入任何缓冲，
 * 因此默认不监听、不存盘，从信号链上避免回授。
 */
export function createMicAnalyzer() {
  let ctx: AudioContext | null = null,
    analyser: AnalyserNode | null = null,
    stream: MediaStream | null = null,
    nodes: AudioNode[] = [],
    engineClock: (() => number) | null = null;
  let spectrum: Float32Array<ArrayBuffer> | null = null,
    wave: Float32Array<ArrayBuffer> | null = null,
    prevMagnitude: Float32Array<ArrayBuffer> | null = null,
    fluxMean = 0.05,
    frameCount = 0;
  // 分析时钟 → 播放时钟的最小二乘校准参数。
  const pairs: { a: number; e: number }[] = [];
  let rate = 1,
    offset = 0;
  return {
    get active() {
      return !!ctx && !!analyser && !!stream;
    },
    get sampleRate() {
      return ctx?.sampleRate ?? 0;
    },
    /** 两个音频时钟的固定偏移（毫秒），用于界面校准展示。 */
    get skewMs() {
      return offset * 1000;
    },
    get driftPpm() {
      return (rate - 1) * 1_000_000;
    },
    async start(engineTime: () => number) {
      if (this.active) return;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      ctx = new AudioContext();
      engineClock = engineTime;
      const source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.55;
      // 只接分析节点，刻意不 connect(ctx.destination)。
      source.connect(analyser);
      nodes = [source];
      spectrum = new Float32Array(analyser.frequencyBinCount);
      wave = new Float32Array(analyser.fftSize);
      prevMagnitude = new Float32Array(analyser.frequencyBinCount);
      pairs.length = 0;
      rate = 1;
      offset = 0;
      fluxMean = 0.05;
      frameCount = 0;
      if (ctx.state === "suspended") await ctx.resume();
    },
    analyze(): AnalysisFrame | null {
      if (!this.active || !analyser || !spectrum || !wave || !prevMagnitude)
        return null;
      const analysisTime = ctx!.currentTime;
      if (engineClock) {
        pairs.push({ a: analysisTime, e: engineClock() });
        if (pairs.length > FIT_SAMPLES) pairs.shift();
        ({ rate, offset } = fitClock(pairs));
      }
      analyser.getFloatFrequencyData(spectrum);
      analyser.getFloatTimeDomainData(wave);
      let sumSq = 0;
      for (const v of wave) sumSq += v * v;
      const rms = Math.sqrt(sumSq / wave.length);
      const binHz = ctx!.sampleRate / FFT_SIZE;
      const chroma = new Array<number>(PITCH_CLASS_COUNT).fill(0);
      const magnitude = new Float32Array(spectrum.length);
      for (let bin = 1; bin < spectrum.length; bin++) {
        const mag = 10 ** (spectrum[bin] / 20);
        magnitude[bin] = mag;
        // 覆盖 C2(36) 到 C8(108) 的常用音域。
        const hz = bin * binHz;
        const midi = 69 + 12 * Math.log2(hz / 440);
        if (midi < 36 || midi > 108) continue;
        const pitchClass = Math.round(midi) % PITCH_CLASS_COUNT;
        chroma[pitchClass] += mag;
      }
      let peak = 0;
      for (const value of chroma) peak = Math.max(peak, value);
      if (peak > 0) for (let i = 0; i < PITCH_CLASS_COUNT; i++) chroma[i] /= peak;
      // 谱通量起音检测，阈值跟随背景噪声自适应，短暂冲击不会触发和弦切换。
      let flux = 0;
      for (let bin = 1; bin < magnitude.length; bin++) {
        const diff = magnitude[bin] - prevMagnitude[bin];
        if (diff > 0) flux += diff;
      }
      flux /= magnitude.length;
      frameCount++;
      fluxMean += (flux - fluxMean) * 0.08;
      const onset = frameCount > 4 && flux > fluxMean * 1.8 && rms > 0.01;
      prevMagnitude.set(magnitude);
      return {
        engineTime: rate * analysisTime + offset,
        rms,
        chroma,
        onset,
      };
    },
    stop() {
      for (const node of nodes)
        try {
          node.disconnect();
        } catch {}
      nodes = [];
      stream?.getTracks().forEach((track) => track.stop());
      void ctx?.close();
      ctx = null;
      analyser = null;
      stream = null;
      spectrum = null;
      wave = null;
      prevMagnitude = null;
      pairs.length = 0;
    },
  };
}
export type MicAnalyzer = ReturnType<typeof createMicAnalyzer>;
