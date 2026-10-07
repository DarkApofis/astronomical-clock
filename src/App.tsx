import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Dome, FULL_VIEW, type View } from './components/Dome';
import { TopBar } from './components/TopBar';
import { TimeControl } from './components/TimeControl';
import { BodyPanel } from './components/BodyPanel';
import { LocationPicker, type GeoState } from './components/LocationPicker';
import {
  bodyDetails, computeBodies, dayFactor, localSiderealDeg, moonInfo, observerFor, project, twilightFactor,
  type BodyId, type Location,
} from './astro/sky';
import { useSimClock } from './lib/clock';
import { wallClock } from './lib/format';
import { prefersReduced, useIsMobile, useOnline, useViewport } from './lib/hooks';
import type { ScaleId } from './lib/scales';

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
/** Backdrop sky while no location has been chosen. */
const FALLBACK: Location = { name: 'Sin ubicación', short: 'Sin ubicación', lat: 40.42, lon: -3.7, tz: BROWSER_TZ };

const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(`cielo.${k}`); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(`cielo.${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

export default function App() {
  const mobile = useIsMobile();
  const { w: vw, h: vh } = useViewport();
  const online = useOnline();
  const clock = useSimClock();
  const { time } = clock;

  // ——— Location ———
  const [location, setLocation] = useState<Location | null>(() => store.get<Location | null>('location', null));
  const [geo, setGeo] = useState<GeoState>(location ? 'ok' : 'idle');
  const [pickerOpen, setPickerOpen] = useState(false);

  const requestGeo = useCallback(() => {
    if (!('geolocation' in navigator)) { setGeo('unavailable'); return; }
    setGeo('pending');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc: Location = { name: 'Mi ubicación', short: 'Mi ubicación', lat: pos.coords.latitude, lon: pos.coords.longitude, tz: BROWSER_TZ };
        setLocation(loc); store.set('location', loc); setGeo('ok'); setPickerOpen(false);
      },
      err => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }, []);

  useEffect(() => { if (!location) requestGeo(); }, []);

  const pickLocation = (l: Location) => { setLocation(l); store.set('location', l); setPickerOpen(false); setGeo(g => (g === 'pending' ? g : 'ok')); };
  const loc = location ?? FALLBACK;
  const needsLocation = !location && (geo === 'denied' || geo === 'unavailable');
  const showPicker = needsLocation || pickerOpen;

  // ——— Settings ———
  const [showConst, setShowConst] = useState(() => store.get('constellations', true));
  const [scale, setScale] = useState<ScaleId>(() => store.get<ScaleId>('scale', 'horas'));
  useEffect(() => store.set('constellations', showConst), [showConst]);
  useEffect(() => store.set('scale', scale), [scale]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === 'c' || e.key === 'C') setShowConst(s => !s);
      else if (e.key === ' ' && !(e.target as HTMLElement).closest('button, [role="slider"]')) { e.preventDefault(); clock.setPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clock.setPlaying]);

  // ——— Sky state ———
  const date = useMemo(() => new Date(time), [time]);
  const obs = useMemo(() => observerFor(loc), [loc]);
  const bodies = useMemo(() => computeBodies(date, obs), [date, obs]);
  const moon = useMemo(() => moonInfo(date), [date]);
  const lst = localSiderealDeg(date, loc.lon);
  const day = dayFactor(bodies.sun.alt);
  const twilight = twilightFactor(bodies.sun.alt);

  // ——— Selection, panel and dome view ———
  const [selected, setSelected] = useState<BodyId | null>(null);
  const [panelId, setPanelId] = useState<BodyId | null>(null);
  const [view, setView] = useState<View>(FULL_VIEW);
  const [following, setFollowing] = useState(false);
  const viewTween = useRef<gsap.core.Tween | null>(null);

  const animateView = useCallback((to: View, onDone?: () => void) => {
    viewTween.current?.kill();
    const proxy = { ...view };
    viewTween.current = gsap.to(proxy, {
      ...to, duration: prefersReduced() ? 0 : 0.6, ease: 'power2.out',
      onUpdate: () => setView({ ...proxy }), onComplete: onDone,
    });
  }, [view]);

  const select = (id: BodyId | null) => {
    setSelected(id);
    if (id) setPanelId(id);
    if (!id || id !== selected) {
      setFollowing(false);
      if (view.k !== 1) animateView(FULL_VIEW);
    }
  };

  const selPos = selected ? project(bodies[selected].alt, bodies[selected].az) : null;
  const centered = view.k > 1.01;
  const onCenter = () => {
    if (!selPos) return;
    if (centered) { setFollowing(false); animateView(FULL_VIEW); }
    else animateView({ k: 2, cx: selPos[0], cy: selPos[1] });
  };
  const onFollow = () => {
    if (following) { setFollowing(false); return; }
    if (!selPos) return;
    animateView({ k: Math.max(2, view.k), cx: selPos[0], cy: selPos[1] }, () => setFollowing(true));
  };
  const effectiveView = following && selPos ? { k: view.k, cx: selPos[0], cy: selPos[1] } : view;

  // Rise/set searches are the expensive part; refresh them at most once per simulated minute.
  const minuteKey = Math.floor(time / 60_000);
  const details = useMemo(
    () => (panelId ? bodyDetails(panelId, new Date(minuteKey * 60_000), obs, bodies[panelId].alt) : null),
    [panelId, minuteKey, obs, panelId ? bodies[panelId].alt > 0 : false],
  );

  // ——— Scrub: pause while the pointer drives time ———
  const wasPlaying = useRef(false);
  const onScrubStart = () => { wasPlaying.current = clock.playing; clock.setPlaying(false); };
  const onScrubEnd = () => { if (wasPlaying.current) clock.setPlaying(true); };

  // ——— Layout ———
  const sheetOpen = mobile && !!selected;
  const offline = !online;
  let domeSize: number, domeTop: number;
  if (mobile) {
    const top = 92 + (offline ? 64 : 0), bottom = 214;
    const avail = vh - top - bottom;
    domeSize = Math.max(240, Math.min(vw, avail + 40));
    domeTop = sheetOpen ? Math.max(56, Math.min(105, vh - 350 - domeSize)) : top + Math.max(0, (avail - domeSize) / 2) + 14;
  } else {
    domeSize = Math.max(320, Math.min(vh - 170, vw - 64));
    domeTop = Math.max(56, (vh - domeSize) / 2 - 26);
  }

  const domeWrap = useRef<HTMLDivElement>(null);
  const firstLayout = useRef(true);
  useLayoutEffect(() => {
    const el = domeWrap.current;
    if (!el) return;
    if (firstLayout.current || prefersReduced()) { gsap.set(el, { y: domeTop }); firstLayout.current = false; return; }
    gsap.to(el, { y: domeTop, duration: 0.42, ease: 'expo.out', overwrite: true });
  }, [domeTop]);

  // ——— Entrance: UI fades + slides 12 px after the sky draws in ———
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const els = rootRef.current?.querySelectorAll('.ui-in');
    if (!els?.length) return;
    const ctx = gsap.context(() => {
      if (prefersReduced()) gsap.from(els, { opacity: 0, duration: 0.15, ease: 'none' });
      else gsap.from(els, { y: 12, opacity: 0, duration: 0.32, ease: 'power2.out', delay: 0.6 });
    });
    return () => ctx.revert();
  }, []);

  const wc = wallClock(time, loc.tz);
  const surfaceAlpha = 0.55 - 0.1 * day;

  return (
    <div ref={rootRef} className={`app ${mobile ? 'is-mobile' : 'is-desktop'}`}
      style={{ '--surface-a': surfaceAlpha } as React.CSSProperties}>
      <div className="sky sky-night" />
      {/* Cubic so twilight stays deep blue (as in the twilight mock) and the sky opens up after sunrise. */}
      <div className="sky sky-day" style={{ opacity: day * day * day }} />

      <div ref={domeWrap} className="dome-wrap" style={{ left: (vw - domeSize) / 2, opacity: needsLocation ? 0.35 : 1 }}>
        <Dome size={domeSize} date={date} lat={loc.lat} lst={lst} bodies={bodies} moon={moon} day={day} twilight={twilight}
          showConstellations={showConst && !needsLocation} selected={selected} onSelect={select} view={effectiveView}
          intro hoverEnabled={!mobile} />
      </div>

      <TopBar mobile={mobile} location={location} locating={geo === 'pending'} wc={wc} time={time}
        onChangeLocation={() => setPickerOpen(true)} onNow={clock.now}
        showConstellations={showConst} onToggleConstellations={() => setShowConst(s => !s)} hideViews={sheetOpen} />

      {offline && (
        <div className={`surface offline ui-in ${mobile ? 'mobile' : ''}`} role="status">
          <span className="offline-dot" aria-hidden="true" />
          <span>Sin conexión. El cielo se calcula en tu dispositivo; solo la búsqueda de ciudades necesita red.</span>
        </div>
      )}

      <div className={`tc-wrap ui-in ${mobile ? 'mobile' : ''} ${sheetOpen ? 'hidden' : ''}`} aria-hidden={sheetOpen || undefined} style={{ opacity: needsLocation ? 0.5 : undefined }}>
        <TimeControl time={time} tz={loc.tz} scale={scale} onScale={setScale}
          playing={clock.playing} onTogglePlay={() => clock.setPlaying(p => !p)}
          speed={clock.speed} onSpeed={clock.setSpeed}
          onScrubStart={onScrubStart} onScrub={clock.setTime} onScrubEnd={onScrubEnd}
          onNow={mobile ? clock.now : undefined} compact={mobile} />
      </div>

      {panelId && (
        <BodyPanel key={`${panelId}-${mobile}`} id={panelId} open={selected === panelId} onExited={() => setPanelId(null)}
          onClose={() => select(null)} pos={bodies[panelId]} moon={moon} details={details} tz={loc.tz} south={loc.lat < 0}
          mobile={mobile} centered={centered} following={following} onCenter={onCenter} onFollow={onFollow} />
      )}

      {showPicker && (
        <LocationPicker required={!location} geo={geo} online={online} onUseGeo={requestGeo} onPick={pickLocation}
          onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}
