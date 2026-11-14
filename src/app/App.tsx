import { useStudio } from "./useStudio";
import { TransportBar, BeatLights } from "@/features/transport";
import { Pads, Keyboard } from "@/features/instruments";
import { Timeline, TrackActions } from "@/features/arrangement";
import { RecordControls, RecordingStatus } from "@/features/recorder";
import { MixerPanel } from "@/features/mixer";
export function App() {
  const s = useStudio();
  if (!s) return <div className="loading">正在打开夜航工作室…</div>;
  const v = s.view(),
    locked = v.recorder.status !== "idle";
  return (
    <div className="studio-shell">
      <aside className="rail">
        <a href="#workspace" className="brand-mark" aria-label="夜航工作室">
          n<span>↗</span>
        </a>
        <span className="rail-icon active" title="工作室">
          ▥
        </span>
        <span className="rail-label">NIGHTSHIFT</span>
        <span className="rail-bottom">01</span>
      </aside>
      <main id="workspace">
        <header>
          <div>
            <div className="eyebrow">YOUR IDEAS, IN THE LOOP.</div>
            <h1>
              夜航<span> / </span>
              <em>Nightshift</em>
              <sup>STUDIO</sup>
            </h1>
            <p>让灵感，循环发生。</p>
          </div>
          <div className="header-actions">
            <span className="local-badge">
              <i /> 本地工作空间
            </span>
            <button onClick={s.load}>↺ 恢复</button>
            <button className="save" onClick={s.save}>
              保存作品 ↗
            </button>
          </div>
        </header>
        <div className="session-title">
          <span>当前作品</span>
          <strong>{v.arrangement.title}</strong>
          <button disabled={locked} onClick={s.demo}>
            试听示范 ↗
          </button>
        </div>
        <TransportBar
          view={v.transport}
          play={() => void s.play()}
          pause={s.pause}
          stop={s.stop}
          configure={s.configure}
          disabled={locked}
        />
        <div className="workspace-grid">
          <section className="panel arrangement-panel">
            <div className="section-heading">
              <div>
                <small>01 / ARRANGE</small>
                <h2>
                  循环编排<span>{v.transport.beats / 4} BARS</span>
                </h2>
              </div>
              <BeatLights
                position={v.transport.position}
                running={v.transport.running}
              />
            </div>
            <TrackActions
              selected={v.selected}
              count={v.arrangement.tracks.length}
              locked={locked}
              add={s.add}
              clear={s.clear}
              remove={s.remove}
            />
            <Timeline
              tracks={v.arrangement.tracks}
              selected={v.arrangement.selected}
              position={v.transport.position}
              beats={v.transport.beats}
              draft={v.recorder.draft}
              select={s.select}
            />
            <div className="arrangement-footer">
              <span>
                <i className="color-dot" />{" "}
                {v.selected
                  ? `已选择 ${v.selected.name}`
                  : "选择一条轨道开始演奏"}
              </span>
              <span>4/4 拍 · 最多 8 条轨道</span>
            </div>
          </section>
          <MixerPanel
            tracks={v.arrangement.tracks}
            channels={v.mixer.channels}
            master={v.mixer.master}
            running={v.transport.running}
            volume={s.volume}
            mute={s.mute}
            setMaster={s.master}
          />
          <section className="panel performance-panel">
            <div className="section-heading">
              <div>
                <small>02 / PERFORM</small>
                <h2>
                  演奏台
                  <span>
                    {v.selected?.instrument === "keys"
                      ? "POLY SYNTH"
                      : "DRUM MACHINE"}
                  </span>
                </h2>
              </div>
              <RecordControls
                state={v.recorder}
                canRecord={!!v.selected}
                record={() => void s.record()}
                cancel={s.cancel}
                setGrid={s.grid}
              />
            </div>
            <div className="instrument-label">
              <span>
                {v.selected?.instrument === "keys"
                  ? "柔和三角波 / WARM TRIANGLE"
                  : "经典合成鼓组 / ANALOG KIT"}
              </span>
              <span>鼠标 · 触控 · 键盘</span>
            </div>
            {v.selected?.instrument === "keys" ? (
              <Keyboard active={v.active} down={s.down} up={s.up} />
            ) : (
              <Pads active={v.active} down={s.down} up={s.up} />
            )}
            <RecordingStatus
              state={v.recorder}
              absolute={v.transport.absolute}
            />
          </section>
        </div>
        <footer>
          <span role="status">{v.message}</span>
          <span>
            <kbd>Space</kbd> 播放 / 暂停 <b>·</b>{" "}
            {v.selected?.instrument === "keys"
              ? "A – K 演奏琴键"
              : "Q W E R 演奏鼓组"}
          </span>
        </footer>
      </main>
    </div>
  );
}
