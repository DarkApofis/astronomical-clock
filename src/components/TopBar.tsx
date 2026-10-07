import { Segmented } from './Segmented';
import type { Location } from '../astro/sky';
import { coord, hhmmss, longDate, shortDate, tzAbbr, type WallClock } from '../lib/format';

type ViewId = 'cielo' | 'reloj' | 'sistema';
const VIEWS = [
  { value: 'cielo' as ViewId, label: 'Cielo' },
  { value: 'reloj' as ViewId, label: 'Reloj', disabled: true, title: 'Próximamente' },
  { value: 'sistema' as ViewId, label: 'Sistema solar', disabled: true, title: 'Próximamente' },
];

export function TopBar({ mobile, location, locating, wc, time, onChangeLocation, onNow, showConstellations, onToggleConstellations, hideViews }: {
  mobile: boolean;
  location: Location | null;
  locating: boolean;
  wc: WallClock;
  time: number;
  onChangeLocation: () => void;
  onNow: () => void;
  showConstellations: boolean;
  onToggleConstellations: () => void;
  hideViews?: boolean;
}) {
  const tz = location?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const pill = (
    <button type="button" className={`surface loc-pill ${location ? '' : 'empty'}`} onClick={onChangeLocation}
      aria-label={location ? `Ubicación: ${location.name}. Cambiar` : 'Elegir ubicación'}>
      <span className="loc-dot" aria-hidden="true" />
      <span className="loc-name">{location ? (mobile ? location.short : location.name) : locating ? 'Localizando…' : 'Sin ubicación'}</span>
      {!mobile && location && <span className="mono loc-coord">{coord(location.lat, location.lon)}</span>}
      {!mobile && location && <span className="loc-change">Cambiar</span>}
    </button>
  );
  const views = <Segmented label="Vista" options={VIEWS} value="cielo" onChange={() => {}} stretch={mobile} className="surface" />;

  if (mobile) {
    return (
      <header className="topbar mobile ui-in">
        <div className="topbar-row">
          {pill}
          <div className="clock mono">
            <span className="clock-date">{shortDate(wc)}</span>
            <span className="clock-time">{hhmmss(wc)}</span>
          </div>
        </div>
        {!hideViews && views}
      </header>
    );
  }

  return (
    <header className="topbar ui-in">
      <div>{pill}</div>
      <div className="clock mono" aria-live="off">
        <span className="clock-date">{longDate(wc)}</span>
        <span className="clock-time">{hhmmss(wc)}</span>
        <span className="clock-tz">{tzAbbr(time, tz)}</span>
      </div>
      <div className="topbar-right">
        <button type="button" className="btn btn-neutral" aria-pressed={showConstellations} onClick={onToggleConstellations}
          title="Mostrar u ocultar constelaciones (C)">Constelaciones</button>
        <button type="button" className="btn btn-accent" onClick={onNow}>Ahora</button>
        {views}
      </div>
    </header>
  );
}
