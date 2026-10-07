import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  BODY_DEFS, BODY_ORDER, HORIZON_R, altAz, eclipticPath, phasePath, project,
  type BodyId, type BodyPos, type MoonInfo,
} from '../astro/sky';
import STARS from '../data/stars.json';
import LINES from '../data/constellation-lines.json';
import { prefersReduced } from '../lib/hooks';

const VB = 520; // viewBox half-size; horizon radius is HORIZON_R (470)
const DEG = Math.PI / 180;

export interface View { k: number; cx: number; cy: number }
export const FULL_VIEW: View = { k: 1, cx: 0, cy: 0 };

type Star = [number, number, number, number];
const stars = STARS as Star[];
const lines = LINES as [number, number][][];

/** Star size/opacity classes from the design: 2.3/1.6/1.05/0.65 units, .95/.7/.42 opacity. */
const starStyle = stars.map(([, , mag, bv]) => {
  const r = mag < 1 ? 2.3 : mag < 2 ? 1.6 : mag < 3.2 ? 1.05 : 0.65;
  const a = mag < 2 ? 0.95 : mag < 3.5 ? 0.7 : mag < 4.5 ? 0.42 : 0.28;
  const color = bv < 0 ? '207,219,255' : bv > 1.1 ? '255,228,200' : '232,236,244';
  return { r, a, color };
});

export interface DomeProps {
  size: number;
  date: Date;
  lat: number;
  lst: number;
  bodies: Record<BodyId, BodyPos>;
  moon: MoonInfo;
  day: number;
  twilight: number;
  showConstellations: boolean;
  selected: BodyId | null;
  onSelect: (id: BodyId | null) => void;
  view: View;
  intro: boolean;
  hoverEnabled: boolean;
}

export function Dome(p: DomeProps) {
  const { size, lat, lst, bodies, moon, day, twilight, view, selected } = p;
  const canvas = useRef<HTMLCanvasElement>(null);
  const horizonRef = useRef<SVGCircleElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);
  const marks = useRef<Partial<Record<BodyId, SVGGElement | null>>>({});
  const labels = useRef<Partial<Record<BodyId, SVGTextElement | null>>>({});
  const [hover, setHover] = useState<BodyId | null>(null);
  const [pulse, setPulse] = useState<{ id: BodyId; n: number } | null>(null);
  const introStart = useRef<number | null>(null);

  // Keep bodies and labels readable on small domes; stars too.
  const unitPx = size / (VB * 2);
  const bodyK = Math.max(1, Math.sqrt(730 / size));
  const starK = Math.max(1, Math.pow(730 / size, 0.8));
  const labelSize = Math.max(12, 11 / unitPx);
  const cardSize = Math.max(15, 11 / unitPx);
  const hitR = Math.max(22, 20 / unitPx);

  const v = (x: number, y: number): [number, number] => [(x - view.cx) * view.k, (y - view.cy) * view.k];

  // ——— Stars & constellations on canvas ———
  const starsAlpha = 1 - 0.95 * day;
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    if (c.width !== px) { c.width = px; c.height = px; }
    const ctx = c.getContext('2d')!;
    const sinLat = Math.sin(lat * DEG), cosLat = Math.cos(lat * DEG);
    const reduced = prefersReduced();
    if (p.intro && introStart.current === null) introStart.current = performance.now();
    let raf = 0;

    const draw = () => {
      const s = (dpr * size) / (VB * 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, px, px);
      ctx.setTransform(s, 0, 0, s, px / 2, px / 2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, HORIZON_R * view.k + 1, 0, Math.PI * 2);
      ctx.clip();
      const elapsed = introStart.current === null ? Infinity : performance.now() - introStart.current;
      const introDone = elapsed > 1000;

      if (p.showConstellations && starsAlpha > 0.02) {
        const a = 0.12 * starsAlpha * (introDone ? 1 : Math.min(1, Math.max(0, (elapsed - 500) / 400)));
        ctx.strokeStyle = `rgba(232,236,244,${a})`;
        ctx.lineWidth = 0.75 / (s / dpr);
        ctx.beginPath();
        for (const pl of lines) {
          let prev: [number, number] | null = null;
          for (const [ra, dec] of pl) {
            const [alt, az] = altAz(ra, dec, lst, sinLat, cosLat);
            const pt = alt > -3 ? v(...project(alt, az)) : null;
            if (pt && prev) { ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]); }
            prev = pt;
          }
        }
        ctx.stroke();
      }

      for (let i = 0; i < stars.length; i++) {
        const [ra, dec] = stars[i];
        const [alt, az] = altAz(ra, dec, lst, sinLat, cosLat);
        if (alt < 0) continue;
        const st = starStyle[i];
        let a = st.a * starsAlpha, r = st.r * starK;
        if (!introDone) {
          // Radial stagger from the zenith outwards: ~900 ms in total.
          const delay = ((90 - alt) / 90) * (reduced ? 0 : 600);
          const t = Math.min(1, Math.max(0, (elapsed - delay) / (reduced ? 150 : 300)));
          const e = 1 - (1 - t) * (1 - t); // power2.out
          a *= e;
          if (!reduced) r *= 0.6 + 0.4 * e;
        }
        if (a < 0.01) continue;
        const [x, y] = v(...project(alt, az));
        ctx.fillStyle = `rgba(${st.color},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (!introDone) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size, lat, lst, starsAlpha, p.showConstellations, view.k, view.cx, view.cy, p.intro, starK]);

  // ——— Horizon stroke draws in on entry ———
  useLayoutEffect(() => {
    const el = horizonRef.current;
    if (!el || !p.intro) return;
    if (prefersReduced()) { gsap.fromTo(el, { opacity: 0 }, { opacity: 0.38, duration: 0.15, ease: 'none' }); return; }
    gsap.fromTo(el, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' });
  }, [p.intro]);

  // ——— Tap ring: scale 0.6 → 1, opacity 1 → 0, 500 ms ———
  useLayoutEffect(() => {
    if (!pulse || !pulseRef.current || prefersReduced()) return;
    gsap.fromTo(pulseRef.current, { scale: 0.6, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.5, ease: 'power2.out', transformOrigin: '50% 50%' });
  }, [pulse]);

  const visible = useMemo(() => BODY_ORDER.filter(id => bodies[id].alt > (id === 'sun' ? -1 : 0)), [bodies]);
  const visibleKey = visible.join();

  // ——— Hover (desktop): 1.15 + label from its centre ———
  useEffect(() => {
    const reduced = prefersReduced();
    for (const id of BODY_ORDER) {
      const m = marks.current[id], l = labels.current[id];
      const on = id === hover;
      const show = on || id === selected;
      if (m) gsap.to(m, { scale: on ? 1.15 : 1, duration: reduced ? 0 : 0.16, ease: 'power2.out', transformOrigin: '50% 50%', overwrite: 'auto' });
      if (l) gsap.to(l, reduced
        ? { opacity: show ? 1 : 0, scaleY: 1, duration: 0.15, ease: 'none', overwrite: 'auto' }
        : { opacity: show ? 1 : 0, scaleY: show ? 1 : 0, duration: 0.18, ease: 'power2.out', transformOrigin: '50% 0%', overwrite: 'auto' });
    }
  }, [hover, selected, visibleKey]);

  const ecl = useMemo(() => eclipticPath(lst, lat), [lst, lat]);
  const [hx, hy] = v(0, 0);
  const R = HORIZON_R * view.k;

  // Twilight glow is masked towards the Sun's side of the horizon.
  const sunDir = useMemo(() => { const a = bodies.sun.az * DEG; return [-Math.sin(a), -Math.cos(a)]; }, [bodies.sun.az]);

  const select = (id: BodyId) => {
    setPulse(q => ({ id, n: (q?.n ?? 0) + 1 }));
    p.onSelect(id);
  };

  return (
    <div className="dome" style={{ width: size, height: size }}>
      <svg className="dome-svg dome-under" viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`} aria-hidden="true">
        <defs>
          <radialGradient id="tw-grad" cx="0" cy="0" r={VB * view.k} gradientUnits="userSpaceOnUse" gradientTransform={`translate(${hx},${hy})`}>
            <stop offset="0.78" stopColor="#FF8C40" stopOpacity="0" />
            <stop offset="0.9" stopColor="#FF9648" stopOpacity="0.32" />
            <stop offset="0.95" stopColor="#FF783C" stopOpacity="0.08" />
            <stop offset="1" stopColor="#FF783C" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="tw-mask-grad" gradientUnits="userSpaceOnUse"
            x1={hx - sunDir[0] * VB} y1={hy - sunDir[1] * VB} x2={hx + sunDir[0] * VB} y2={hy + sunDir[1] * VB}>
            <stop offset="0.25" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.65" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="tw-mask"><rect x={-VB * 4} y={-VB * 4} width={VB * 8} height={VB * 8} fill="url(#tw-mask-grad)" /></mask>
        </defs>
        {twilight > 0.01 && (
          <circle cx={hx} cy={hy} r={VB * view.k} fill="url(#tw-grad)" mask="url(#tw-mask)" opacity={twilight} />
        )}
      </svg>
      <canvas ref={canvas} className="dome-canvas" style={{ width: size, height: size }} />
      <svg className="dome-svg" viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}
        role="img" aria-label="Cielo visible desde tu ubicación"
        onClick={e => { if (e.target === e.currentTarget || (e.target as Element).classList.contains('dome-bg')) p.onSelect(null); }}>
        <defs>
          <clipPath id="dome-clip"><circle r={VB} /></clipPath>
        </defs>
        <circle className="dome-bg" r={VB} fill="transparent" />
        <g clipPath="url(#dome-clip)">
          <circle cx={hx} cy={hy} r={157 * view.k} className="alt-ring" />
          <circle cx={hx} cy={hy} r={313 * view.k} className="alt-ring" />
          <path d={ecl} transform={`scale(${view.k}) translate(${-view.cx},${-view.cy})`} className="ecliptic"
            style={{ opacity: 0.32 - 0.1 * day, strokeWidth: 1 / view.k, strokeDasharray: `${1.5 / view.k} ${7 / view.k}` }} />
          <circle ref={horizonRef} cx={hx} cy={hy} r={R} className="horizon" pathLength={1} />
          {([[0, -1, 'N'], [0, 1, 'S'], [-1, 0, 'E'], [1, 0, 'O']] as const).map(([dx, dy, l]) => (
            <g key={l}>
              <line x1={hx + dx * R} y1={hy + dy * R} x2={hx + dx * (R + 10)} y2={hy + dy * (R + 10)} className="card-tick" />
              <text x={hx + dx * (R + 26)} y={hy + dy * (R + 26) + cardSize * 0.35} className="card-label" style={{ fontSize: cardSize }}>{l}</text>
            </g>
          ))}

          {visible.map(id => {
            const def = BODY_DEFS[id], b = bodies[id];
            const [x, y] = v(...project(b.alt, b.az));
            const isSel = id === selected;
            const k = bodyK;
            const ring = Math.max(def.r * k + 9, 14);
            const labelY = (id === 'sun' || id === 'moon' ? 34 : def.r + 16) * k + labelSize * 0.35;
            const fade = id === 'sun' ? 1 : id === 'moon' ? 1 - 0.4 * day : 1 - 0.8 * day;
            return (
              <g key={id} transform={`translate(${x.toFixed(2)},${y.toFixed(2)})`} className="body"
                onPointerEnter={e => { if (p.hoverEnabled && e.pointerType === 'mouse') setHover(id); }}
                onPointerLeave={() => setHover(h => (h === id ? null : h))}
                onClick={e => { e.stopPropagation(); select(id); }}
                role="button" tabIndex={0} aria-label={def.name} aria-pressed={isSel}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id); } }}>
                <circle r={hitR} fill="transparent" />
                <g ref={el => { marks.current[id] = el; }} opacity={fade}>
                  {id === 'sun' ? (
                    <>
                      <circle r={64 * k} fill={def.color} opacity={0.07} />
                      <circle r={32 * k} fill={def.color} opacity={0.14} />
                      <circle r={13 * k} fill={def.color} />
                    </>
                  ) : id === 'moon' ? (
                    <>
                      <circle r={28 * k} fill={def.color} opacity={0.06} />
                      <circle r={11 * k} fill="#E8ECF4" opacity={0.14} />
                      <path d={phasePath(moon.fraction, moon.waxing !== lat < 0, 11 * k)} fill={def.color} />
                    </>
                  ) : (
                    <>
                      <circle r={def.glow * k} fill={def.color} opacity={0.12} />
                      <circle r={def.r * k} fill={def.color} />
                    </>
                  )}
                </g>
                {isSel && (
                  <>
                    <circle r={ring} className="sel-ring" opacity={0.9} />
                    <circle r={ring * 1.5} className="sel-ring" opacity={0.28} />
                  </>
                )}
                {pulse?.id === id && <circle key={pulse.n} ref={pulseRef} r={ring * 1.5} className="sel-ring" opacity={0} />}
                <text ref={el => { labels.current[id] = el; }} y={labelY} className="body-label" style={{ fontSize: labelSize, opacity: 0 }}>{def.name}</text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
