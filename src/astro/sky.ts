import * as A from 'astronomy-engine';

export type BodyId = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

export interface BodyDef {
  id: BodyId;
  name: string;
  kind: string;
  body: A.Body;
  color: string;
  /** Radius and glow radius in dome units (viewBox is 1040 wide, horizon r = 470). */
  r: number;
  glow: number;
}

export const BODY_DEFS: Record<BodyId, BodyDef> = {
  sun: { id: 'sun', name: 'Sol', kind: 'ESTRELLA', body: A.Body.Sun, color: '#F5C76B', r: 13, glow: 32 },
  moon: { id: 'moon', name: 'Luna', kind: 'SATÉLITE NATURAL', body: A.Body.Moon, color: '#F2EFE6', r: 11, glow: 28 },
  mercury: { id: 'mercury', name: 'Mercurio', kind: 'PLANETA', body: A.Body.Mercury, color: '#C9C3B8', r: 2.8, glow: 10 },
  venus: { id: 'venus', name: 'Venus', kind: 'PLANETA', body: A.Body.Venus, color: '#FFFFFF', r: 4.6, glow: 16 },
  mars: { id: 'mars', name: 'Marte', kind: 'PLANETA', body: A.Body.Mars, color: '#E07A5F', r: 3.2, glow: 11 },
  jupiter: { id: 'jupiter', name: 'Júpiter', kind: 'PLANETA', body: A.Body.Jupiter, color: '#EEDFB8', r: 4.2, glow: 14 },
  saturn: { id: 'saturn', name: 'Saturno', kind: 'PLANETA', body: A.Body.Saturn, color: '#E0B36A', r: 3.6, glow: 12 },
};

export const BODY_ORDER: BodyId[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'sun', 'moon'];

export interface Location {
  name: string;
  /** Short name used on mobile. */
  short: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface BodyPos {
  id: BodyId;
  alt: number;
  az: number;
  distAU: number;
}

export const HORIZON_R = 470;
const DEG = Math.PI / 180;
export const AU_KM = 149597870.7;

export function observerFor(loc: Location) {
  return new A.Observer(loc.lat, loc.lon, 0);
}

export function computeBodies(date: Date, obs: A.Observer): Record<BodyId, BodyPos> {
  const out = {} as Record<BodyId, BodyPos>;
  for (const id of BODY_ORDER) {
    const def = BODY_DEFS[id];
    const eq = A.Equator(def.body, date, obs, true, true);
    const hor = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
    out[id] = { id, alt: hor.altitude, az: hor.azimuth, distAU: eq.dist };
  }
  return out;
}

/** Local sidereal time in degrees. */
export function localSiderealDeg(date: Date, lon: number) {
  return (((A.SiderealTime(date) * 15 + lon) % 360) + 360) % 360;
}

/** Fast RA/Dec (degrees) → altitude/azimuth (degrees, azimuth from N towards E). No refraction. */
export function altAz(raDeg: number, decDeg: number, lstDeg: number, sinLat: number, cosLat: number): [number, number] {
  const H = (lstDeg - raDeg) * DEG;
  const d = decDeg * DEG;
  const sd = Math.sin(d), cd = Math.cos(d), cH = Math.cos(H);
  const alt = Math.asin(sinLat * sd + cosLat * cd * cH);
  const az = Math.atan2(-Math.sin(H) * cd, sd * cosLat - cd * sinLat * cH);
  return [alt / DEG, ((az / DEG) + 360) % 360];
}

/** Azimuthal equidistant projection: zenith at centre, N up, E left (looking up at the sky). */
export function project(alt: number, az: number, R = HORIZON_R): [number, number] {
  const rr = ((90 - alt) / 90) * R;
  const a = az * DEG;
  return [-Math.sin(a) * rr, -Math.cos(a) * rr];
}

const OBLIQUITY = 23.4393 * DEG;
/** Ecliptic sampled every 3° as RA/Dec pairs (degrees). */
export const ECLIPTIC: [number, number][] = Array.from({ length: 121 }, (_, i) => {
  const l = i * 3 * DEG;
  const ra = Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY), Math.cos(l)) / DEG;
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(l)) / DEG;
  return [(ra + 360) % 360, dec];
});

export function eclipticPath(lstDeg: number, lat: number) {
  const s = Math.sin(lat * DEG), c = Math.cos(lat * DEG);
  let d = '';
  let pen = false;
  for (const [ra, dec] of ECLIPTIC) {
    const [alt, az] = altAz(ra, dec, lstDeg, s, c);
    if (alt < 0) { pen = false; continue; }
    const [x, y] = project(alt, az);
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

export interface MoonInfo {
  fraction: number;
  waxing: boolean;
  ageDays: number;
  phaseName: string;
}

const PHASE_NAMES = ['Nueva', 'Creciente', 'Cuarto creciente', 'Gibosa creciente', 'Llena', 'Gibosa menguante', 'Cuarto menguante', 'Menguante'];

export function moonInfo(date: Date): MoonInfo {
  const elong = A.MoonPhase(date);
  const fraction = A.Illumination(A.Body.Moon, date).phase_fraction;
  return {
    fraction,
    waxing: elong < 180,
    ageDays: (elong / 360) * 29.530588,
    phaseName: PHASE_NAMES[Math.round(elong / 45) % 8],
  };
}

/**
 * Lit part of the Moon disc as an SVG path. Semicircle of radius r plus an elliptical
 * terminator with rx = |2f − 1|·r. `rightLit` = bright limb on the right.
 */
export function phasePath(f: number, rightLit: boolean, r: number) {
  const rx = (Math.abs(2 * f - 1) * r).toFixed(2);
  const a = rightLit ? 1 : 0;
  const s = rightLit ? (f > 0.5 ? 1 : 0) : (f > 0.5 ? 0 : 1);
  return `M 0,-${r} A ${r},${r} 0 0 ${a} 0,${r} A ${rx},${r} 0 0 ${s} 0,-${r}`;
}

export interface BodyDetails {
  rise: Date | null;
  set: Date | null;
  mag: number;
}

export function bodyDetails(id: BodyId, date: Date, obs: A.Observer, alt: number): BodyDetails {
  const body = BODY_DEFS[id].body;
  const find = (dir: number, from: Date, days: number) => {
    const t = A.SearchRiseSet(body, obs, dir, from, days);
    return t ? t.date : null;
  };
  let rise: Date | null, set: Date | null;
  if (alt > 0) {
    rise = find(+1, date, -1.5);
    set = find(-1, date, 1.5);
  } else {
    rise = find(+1, date, 1.5);
    set = rise ? find(-1, rise, 1.5) : find(-1, date, 1.5);
  }
  return { rise, set, mag: A.Illumination(body, date).mag };
}

/** 0 at night (Sun ≤ −18°), 1 in full day (Sun ≥ +10°). */
export function dayFactor(sunAlt: number) {
  return Math.min(1, Math.max(0, (sunAlt + 18) / 28));
}

/** Orange horizon band: full strength for Sun altitude in [−6°, +4°], fading out by −12° / +10°. */
export function twilightFactor(sunAlt: number) {
  if (sunAlt < -12 || sunAlt > 10) return 0;
  if (sunAlt < -6) return (sunAlt + 12) / 6;
  if (sunAlt > 4) return (10 - sunAlt) / 6;
  return 1;
}
