import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { MoonPhaseIcon } from './MoonPhaseIcon';
import { AU_KM, BODY_DEFS, type BodyDetails, type BodyId, type BodyPos, type MoonInfo } from '../astro/sky';
import { cardinal, days1, degMin, distance, hhmm, percent, signed, wallClock } from '../lib/format';
import { prefersReduced } from '../lib/hooks';

export interface BodyPanelProps {
  id: BodyId;
  open: boolean;
  onExited: () => void;
  onClose: () => void;
  pos: BodyPos;
  moon: MoonInfo;
  details: BodyDetails | null;
  tz: string;
  south: boolean;
  mobile: boolean;
  centered: boolean;
  following: boolean;
  onCenter: () => void;
  onFollow: () => void;
}

export function BodyPanel(p: BodyPanelProps) {
  const { id, pos, moon, details, tz, mobile } = p;
  const def = BODY_DEFS[id];
  const root = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);

  // Enter from the edge (expo.out, 420 ms); leave in 220 ms power2.in.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = prefersReduced();
    const hidden = reduced ? { opacity: 0 } : mobile ? { yPercent: 100 } : { x: 24, opacity: 0 };
    const shown = reduced ? { opacity: 1 } : mobile ? { yPercent: 0 } : { x: 0, opacity: 1 };
    const tw = p.open
      ? gsap.fromTo(el, hidden, { ...shown, duration: reduced ? 0.15 : 0.42, ease: reduced ? 'none' : 'expo.out' })
      : gsap.to(el, { ...hidden, duration: reduced ? 0.15 : 0.22, ease: reduced ? 'none' : 'power2.in', onComplete: p.onExited });
    return () => { tw.kill(); };
  }, [p.open, mobile]);

  // Name types in with a fast per-character split.
  useLayoutEffect(() => {
    const chars = nameRef.current?.querySelectorAll('.ch');
    if (!chars?.length) return;
    if (prefersReduced()) { gsap.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none' }); return; }
    gsap.fromTo(chars, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.18, stagger: 0.012, ease: 'power2.out' });
  }, [id]);

  const time = (d: Date | null | undefined) => (d ? hhmm(wallClock(d.getTime(), tz)) : '—');
  const [dist, unit] = distance(pos.distAU * AU_KM, pos.distAU, id === 'moon');
  const name = (
    <div ref={nameRef} className={mobile ? 'panel-name sm' : 'panel-name'} aria-label={def.name}>
      {Array.from(def.name).map((c, i) => <span key={i} className="ch" aria-hidden="true">{c}</span>)}
    </div>
  );
  const eyebrow = <div className="eyebrow">{def.kind}</div>;

  const fields: [string, React.ReactNode][] = [
    ['Altitud', degMin(pos.alt, true)],
    ['Acimut', <>{degMin(pos.az, false)} {!mobile && <span className="unit">{cardinal(pos.az)}</span>}</>],
    ...(mobile ? [['Distancia', `${dist} ${unit}`] as [string, React.ReactNode]] : []),
    ['Salida', time(details?.rise)],
    ['Puesta', time(details?.set)],
    ...(!mobile ? [['Distancia', <>{dist} <span className="unit">{unit}</span></>] as [string, React.ReactNode]] : []),
    ['Magnitud', details ? signed(details.mag) : '—'],
  ];

  const actions = (
    <div className="panel-actions">
      <button type="button" className="btn btn-primary" onClick={p.onCenter}>{p.centered ? 'Vista completa' : 'Centrar'}</button>
      <button type="button" className="btn btn-accent" aria-pressed={p.following} onClick={p.onFollow}>{p.following ? 'Siguiendo' : 'Seguir'}</button>
    </div>
  );

  if (mobile) {
    return (
      <div ref={root} className="sheet" role="dialog" aria-label={def.name}>
        <button type="button" className="sheet-grip" aria-label="Cerrar" onClick={p.onClose}><span /></button>
        <div className="sheet-head">
          <div className="sheet-title">
            {id === 'moon' && <MoonPhaseIcon fraction={moon.fraction} waxing={moon.waxing} south={p.south} size={44} />}
            <div>{eyebrow}{name}</div>
          </div>
          {id === 'moon' && (
            <div className="sheet-phase">
              <div className="phase-name">{moon.phaseName}</div>
              <div className="mono dim">{percent(moon.fraction)} · {days1(moon.ageDays)} d</div>
            </div>
          )}
        </div>
        <div className="fields fields-3">
          {fields.map(([k, v]) => <div key={k} className="field"><div className="field-k">{k}</div><div className="field-v">{v}</div></div>)}
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div ref={root} className="surface panel" role="dialog" aria-label={def.name}>
      <div className="panel-head">
        <div>{eyebrow}{name}</div>
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={p.onClose}><span className="x" aria-hidden="true" /></button>
      </div>
      {id === 'moon' && (
        <div className="phase-card">
          <MoonPhaseIcon fraction={moon.fraction} waxing={moon.waxing} south={p.south} />
          <div>
            <div className="phase-name">{moon.phaseName}</div>
            <div className="mono dim">{percent(moon.fraction)} iluminada · {days1(moon.ageDays)} días</div>
          </div>
        </div>
      )}
      <div className="fields fields-2">
        {fields.map(([k, v]) => <div key={k} className="field"><div className="field-k">{k}</div><div className="field-v">{v}</div></div>)}
      </div>
      {actions}
    </div>
  );
}
