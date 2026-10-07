import { MONTHS, WEEKDAYS, hhmm, hhmmss, pad, tzOffset, type WallClock } from './format';

export type ScaleId = 'minutos' | 'horas' | 'dias' | 'meses' | 'anos';

export const SCALE_OPTIONS: { value: ScaleId; label: string }[] = [
  { value: 'minutos', label: 'Min' },
  { value: 'horas', label: 'Horas' },
  { value: 'dias', label: 'Días' },
  { value: 'meses', label: 'Meses' },
  { value: 'anos', label: 'Años' },
];

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

export interface Tick { t: number; major: boolean; label: string }

export interface ScaleDef {
  /** Visible window width in ms. */
  span: number;
  /** Keyboard step (one minor tick) in ms. */
  step: number;
  majorStep: number;
  handle: (w: WallClock) => string;
  ticks: (from: number, to: number, tz: string) => Tick[];
}

/** Walk wall-clock time in a time zone using a fixed offset sampled at the window centre. */
function walk(from: number, to: number, tz: string, first: (local: Date) => void, next: (local: Date) => void,
  tick: (local: Date) => Omit<Tick, 't'>): Tick[] {
  const off = tzOffset((from + to) / 2, tz);
  const d = new Date(from + off);
  first(d);
  const out: Tick[] = [];
  for (let guard = 0; guard < 400 && d.getTime() - off <= to; guard++) {
    const t = d.getTime() - off;
    if (t >= from) out.push({ t, ...tick(d) });
    next(d);
  }
  return out;
}

export const SCALES: Record<ScaleId, ScaleDef> = {
  minutos: {
    span: 60 * MIN, step: 2 * MIN, majorStep: 10 * MIN,
    handle: hhmmss,
    ticks: (a, b, tz) => walk(a, b, tz,
      d => { d.setUTCSeconds(0, 0); d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 2) * 2); },
      d => d.setUTCMinutes(d.getUTCMinutes() + 2),
      d => { const major = d.getUTCMinutes() % 10 === 0; return { major, label: major ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : '' }; }),
  },
  horas: {
    span: 24 * HOUR, step: HOUR, majorStep: 3 * HOUR,
    handle: hhmm,
    ticks: (a, b, tz) => walk(a, b, tz,
      d => d.setUTCMinutes(0, 0, 0),
      d => d.setUTCHours(d.getUTCHours() + 1),
      d => { const major = d.getUTCHours() % 3 === 0; return { major, label: major ? `${pad(d.getUTCHours())}:00` : '' }; }),
  },
  dias: {
    span: 30 * DAY, step: DAY, majorStep: 5 * DAY,
    handle: w => `${WEEKDAYS[w.weekday]} ${pad(w.day)} ${MONTHS[w.month]}`,
    ticks: (a, b, tz) => walk(a, b, tz,
      d => d.setUTCHours(0, 0, 0, 0),
      d => d.setUTCDate(d.getUTCDate() + 1),
      d => { const major = (d.getUTCDate() - 1) % 5 === 0 && d.getUTCDate() < 31; return { major, label: major ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` : '' }; }),
  },
  meses: {
    span: 730.5 * DAY, step: 30.44 * DAY, majorStep: 91.3 * DAY,
    handle: w => `${MONTHS[w.month]} ${w.year}`,
    ticks: (a, b, tz) => walk(a, b, tz,
      d => { d.setUTCHours(0, 0, 0, 0); d.setUTCDate(1); },
      d => d.setUTCMonth(d.getUTCMonth() + 1),
      d => { const major = d.getUTCMonth() % 3 === 0; return { major, label: major ? `${MONTHS[d.getUTCMonth()]} ${pad(((d.getUTCFullYear() % 100) + 100) % 100)}` : '' }; }),
  },
  anos: {
    span: 20 * 365.25 * DAY, step: 365.25 * DAY, majorStep: 5 * 365.25 * DAY,
    handle: w => String(w.year),
    ticks: (a, b, tz) => walk(a, b, tz,
      d => { d.setUTCHours(0, 0, 0, 0); d.setUTCMonth(0, 1); },
      d => d.setUTCFullYear(d.getUTCFullYear() + 1),
      d => { const major = d.getUTCFullYear() % 5 === 0; return { major, label: major ? String(d.getUTCFullYear()) : '' }; }),
  },
};

/** "1 px ≈ 1,5 min" style hint. */
export function pxHint(msPerPx: number) {
  const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
  const units: [number, string][] = [[365.25 * DAY, 'años'], [DAY, 'días'], [HOUR, 'h'], [MIN, 'min'], [1000, 's']];
  for (const [u, l] of units) {
    if (msPerPx >= u) {
      const n = msPerPx / u;
      const label = n < 1.05 && l === 'días' ? 'día' : n < 1.05 && l === 'años' ? 'año' : l;
      return `1 px ≈ ${nf.format(n)} ${label}`;
    }
  }
  return `1 px ≈ ${nf.format(msPerPx / 1000)} s`;
}
