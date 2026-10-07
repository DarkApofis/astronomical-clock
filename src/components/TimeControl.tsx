import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { RollingText } from './RollingText';
import { Segmented } from './Segmented';
import { SCALES, SCALE_OPTIONS, pxHint, type ScaleId } from '../lib/scales';
import { SPEEDS, type Speed } from '../lib/clock';
import { hhmmss, longDate, wallClock } from '../lib/format';
import { prefersReduced } from '../lib/hooks';

export interface TimeControlProps {
  time: number;
  tz: string;
  scale: ScaleId;
  onScale: (s: ScaleId) => void;
  playing: boolean;
  onTogglePlay: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  onScrubStart: () => void;
  onScrub: (t: number) => void;
  onScrubEnd: () => void;
  onNow?: () => void;
  compact?: boolean;
  className?: string;
}

const SPEED_OPTIONS = SPEEDS.map(s => ({ value: String(s) as `${Speed}`, label: `${s}×` }));

export function TimeControl(p: TimeControlProps) {
  const { time, tz, scale, compact } = p;
  const def = SCALES[scale];
  const track = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  // While dragging / settling, the tick window stays put and the handle moves; otherwise it follows time.
  const [frozenCenter, setFrozenCenter] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ from: number; to: number; p: number } | null>(null);
  const drag = useRef<{ id: number; startX: number; startT: number; samples: [number, number][] } | null>(null);
  const settle = useRef<gsap.core.Tween | null>(null);
  const prevScale = useRef(scale);
  const prevTime = useRef(time);
  const dir = useRef<1 | -1>(1);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [compact]);

  // Scale change: ticks regroup by zooming the window from the old span to the new one (no fade).
  useLayoutEffect(() => {
    if (prevScale.current === scale) return;
    const from = SCALES[prevScale.current].span, to = def.span;
    prevScale.current = scale;
    if (prefersReduced()) { setZoom(null); return; }
    const proxy = { p: 0 };
    setZoom({ from, to, p: 0 });
    const tw = gsap.to(proxy, {
      p: 1, duration: 0.36, ease: 'power3.inOut',
      onUpdate: () => setZoom({ from, to, p: proxy.p }),
      onComplete: () => setZoom(null),
    });
    return () => { tw.kill(); };
  }, [scale, def.span]);

  if (time !== prevTime.current) { dir.current = time > prevTime.current ? 1 : -1; prevTime.current = time; }

  const span = zoom ? Math.exp(Math.log(zoom.from) + (Math.log(zoom.to) - Math.log(zoom.from)) * zoom.p) : def.span;
  const center = frozenCenter ?? time;
  const msPerPx = w > 0 ? span / w : 1;
  const ticks = w > 0 ? def.ticks(center - def.span / 2, center + def.span / 2, tz) : [];
  const xOf = (t: number) => w / 2 + (t - center) / msPerPx;
  const handleX = Math.min(w, Math.max(0, xOf(time)));
  const labelAlpha = zoom ? Math.max(0, (zoom.p - 0.55) / 0.45) : 1;

  const wc = wallClock(time, tz);
  const handleText = def.handle(wc);

  const timeAt = (clientX: number, from: number, startX: number) => from + (clientX - startX) * (def.span / Math.max(1, w));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !track.current) return;
    e.preventDefault();
    settle.current?.kill();
    const rect = track.current.getBoundingClientRect();
    const onHandle = (e.target as Element).closest('.handle');
    const c = frozenCenter ?? time;
    // Grabbing the handle drags relatively; tapping the track jumps to that point first.
    const startT = onHandle ? time : c + (e.clientX - rect.left - rect.width / 2) * (def.span / Math.max(1, w));
    drag.current = { id: e.pointerId, startX: e.clientX, startT, samples: [[performance.now(), startT]] };
    e.currentTarget.setPointerCapture(e.pointerId);
    setFrozenCenter(c);
    p.onScrubStart();
    if (!onHandle) p.onScrub(startT);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const t = timeAt(e.clientX, d.startT, d.startX);
    d.samples.push([performance.now(), t]);
    if (d.samples.length > 8) d.samples.shift();
    p.onScrub(t);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const now = performance.now();
    const recent = d.samples.filter(([ts]) => now - ts < 100);
    let extra = 0;
    if (recent.length > 1 && !prefersReduced()) {
      const [t0, v0] = recent[0], [t1, v1] = recent[recent.length - 1];
      const v = (v1 - v0) / Math.max(16, t1 - t0);
      extra = Math.max(-def.span * 0.12, Math.min(def.span * 0.12, v * 120));
    }
    // Short deceleration after release (power2.out, 400 ms); the tick window recentres under the handle.
    const proxy = { t: time, c: frozenCenter ?? time };
    const target = time + extra;
    settle.current = gsap.to(proxy, {
      t: target, c: target, duration: prefersReduced() ? 0.15 : 0.4, ease: 'power2.out',
      onUpdate: () => { if (extra) p.onScrub(proxy.t); setFrozenCenter(proxy.c); },
      onComplete: () => { setFrozenCenter(null); p.onScrubEnd(); settle.current = null; },
    });
  };

  useEffect(() => () => { settle.current?.kill(); }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const big = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown';
    const step = big ? def.majorStep : def.step;
    let d = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') d = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') d = -step;
    else if (e.key === 'Home' && p.onNow) { p.onNow(); e.preventDefault(); return; }
    if (!d) return;
    e.preventDefault();
    p.onScrub(time + d);
  };

  const scaleSeg = (
    <Segmented label="Escala del arrastre" size="sm" stretch={compact} options={SCALE_OPTIONS} value={scale} onChange={p.onScale} />
  );
  const playBtn = (
    <button type="button" className={`play ${compact ? 'play-lg' : ''}`} onClick={p.onTogglePlay}
      aria-label={p.playing ? 'Pausar' : 'Reproducir'} aria-pressed={p.playing}>
      {p.playing
        ? <span className="pause-icon" aria-hidden="true"><span /><span /></span>
        : <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><polygon points="2,1 11,6 2,11" fill="currentColor" /></svg>}
    </button>
  );
  const speedSeg = (
    <Segmented label="Velocidad" size="sm" mono options={SPEED_OPTIONS}
      value={String(p.speed) as `${Speed}`} onChange={v => p.onSpeed(Number(v) as Speed)} className={compact ? 'seg-32' : ''} />
  );

  const scrubber = (
    <div className="scrub" ref={track}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      role="slider" tabIndex={0} aria-label="Tiempo" aria-valuetext={`${longDate(wc)} ${hhmmss(wc)}`}
      aria-valuenow={Math.round(time / 1000)} onKeyDown={onKeyDown}>
      <div className="scrub-ticks">
        {ticks.map(t => (
          <div key={t.t} className="tick" style={{ transform: `translateX(${xOf(t.t).toFixed(1)}px)` }}>
            <div className={`tick-line ${t.major ? 'major' : ''}`} />
            <div className="tick-label" style={{ opacity: labelAlpha }}>{t.label}</div>
          </div>
        ))}
      </div>
      <div className="scrub-base" />
      <div className="handle" style={{ transform: `translateX(${handleX.toFixed(1)}px)` }}>
        <div className="handle-inner">
          <div className="handle-pill"><RollingText text={handleText} dir={dir.current} /></div>
          <div className="handle-stem" />
          <div className={`handle-dot ${compact ? 'lg' : ''}`} />
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className={`surface time-control compact ${p.className ?? ''}`}>
        {scaleSeg}
        <div className="scrub-wrap">{scrubber}</div>
        <div className="tc-row">
          <div className="tc-group">{playBtn}{speedSeg}</div>
          {p.onNow && <button type="button" className="btn btn-accent" onClick={p.onNow}>Ahora</button>}
        </div>
      </div>
    );
  }

  return (
    <div className={`surface time-control wide ${p.className ?? ''}`}>
      <div className="tc-group tc-left">{playBtn}{speedSeg}</div>
      {scrubber}
      <div className="tc-right">
        {scaleSeg}
        <div className="tc-hint">{pxHint(def.span / Math.max(1, w))}</div>
      </div>
    </div>
  );
}
