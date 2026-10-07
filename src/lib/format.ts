export const WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
export const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export interface WallClock {
  year: number;
  month: number; // 0-11
  day: number;
  weekday: number; // 0 = domingo
  hour: number;
  minute: number;
  second: number;
}

const partsFmt = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string) {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      weekday: 'short', hour: 'numeric', minute: 'numeric', second: 'numeric', era: 'short',
    });
    partsFmt.set(tz, f);
  }
  return f;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function wallClock(ms: number, tz: string): WallClock {
  const p: Record<string, string> = {};
  for (const part of fmtFor(tz).formatToParts(ms)) p[part.type] = part.value;
  const y = +p.year;
  return {
    year: p.era === 'BC' ? 1 - y : y,
    month: +p.month - 1, day: +p.day, weekday: WD[p.weekday] ?? 0,
    hour: +p.hour % 24, minute: +p.minute, second: +p.second,
  };
}

/** Offset of `tz` from UTC at instant `ms`, in milliseconds. */
export function tzOffset(ms: number, tz: string) {
  const w = wallClock(ms, tz);
  const d = new Date(0);
  d.setUTCFullYear(w.year, w.month, w.day);
  d.setUTCHours(w.hour, w.minute, w.second, 0);
  return d.getTime() - (ms - (((ms % 1000) + 1000) % 1000));
}

const tzNameFmt = new Map<string, Intl.DateTimeFormat>();
export function tzAbbr(ms: number, tz: string) {
  let f = tzNameFmt.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('es-ES', { timeZone: tz, timeZoneName: 'short' }); tzNameFmt.set(tz, f); }
  return f.formatToParts(ms).find(p => p.type === 'timeZoneName')?.value ?? '';
}

export const pad = (n: number) => String(n).padStart(2, '0');

export const hhmmss = (w: WallClock) => `${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}`;
export const hhmm = (w: WallClock) => `${pad(w.hour)}:${pad(w.minute)}`;
export const longDate = (w: WallClock) => `${WEEKDAYS[w.weekday]} ${pad(w.day)} ${MONTHS[w.month]} ${w.year}`;
export const shortDate = (w: WallClock) => `${pad(w.day)} ${MONTHS[w.month]}`;

const MINUS = '−';
const nf = (digits: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: true });
const nf0 = nf(0), nf1 = nf(1), nf2 = nf(2);

export function signed(n: number, f = nf1) {
  const s = f.format(Math.abs(n));
  return n < 0 ? MINUS + s : s;
}

export function degMin(v: number, withSign: boolean) {
  const sign = v < 0 ? MINUS : withSign ? '+' : '';
  let a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.round((a - d) * 60);
  if (m === 60) { d += 1; m = 0; }
  return `${sign}${d}° ${pad(m)}′`;
}

const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export const cardinal = (az: number) => CARD[Math.round(az / 45) % 8];

/** Moon distance in km (with thin-space grouping as in the design), other bodies in AU. */
export function distance(km: number, au: number, useKm: boolean): [string, string] {
  // es-ES only groups numbers ≥ 10 000; force a grouping space for readability.
  if (useKm) return [Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '), 'km'];
  return [nf2.format(au), 'UA'];
}

export const percent = (f: number) => `${nf0.format(Math.round(f * 100))} %`;
export const days1 = (d: number) => nf1.format(d);
export const coord = (lat: number, lon: number) =>
  `${nf2.format(Math.abs(lat)).replace(',', '.')}°${lat >= 0 ? 'N' : 'S'} · ${nf2.format(Math.abs(lon)).replace(',', '.')}°${lon >= 0 ? 'E' : 'O'}`;
