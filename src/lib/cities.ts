import type { Location } from '../astro/sky';

const c = (name: string, short: string, lat: number, lon: number, tz: string): Location => ({ name, short, lat, lon, tz });

/** Shown as chips in the location picker, in this order. */
export const POPULAR_CITIES: Location[] = [
  c('Madrid, España', 'Madrid', 40.4168, -3.7038, 'Europe/Madrid'),
  c('Ciudad de México, México', 'CDMX', 19.4326, -99.1332, 'America/Mexico_City'),
  c('Buenos Aires, Argentina', 'Buenos Aires', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'),
  c('Bogotá, Colombia', 'Bogotá', 4.711, -74.0721, 'America/Bogota'),
  c('Lima, Perú', 'Lima', -12.0464, -77.0428, 'America/Lima'),
  c('Santiago, Chile', 'Santiago', -33.4489, -70.6693, 'America/Santiago'),
  c('Barcelona, España', 'Barcelona', 41.3874, 2.1686, 'Europe/Madrid'),
];

/** Searchable offline; the online geocoder extends this when there is a connection. */
export const CITIES: Location[] = [
  ...POPULAR_CITIES,
  c('Sevilla, España', 'Sevilla', 37.3891, -5.9845, 'Europe/Madrid'),
  c('Valencia, España', 'Valencia', 39.4699, -0.3763, 'Europe/Madrid'),
  c('Bilbao, España', 'Bilbao', 43.263, -2.935, 'Europe/Madrid'),
  c('Las Palmas de Gran Canaria, España', 'Las Palmas', 28.1235, -15.4363, 'Atlantic/Canary'),
  c('Guadalajara, México', 'Guadalajara', 20.6597, -103.3496, 'America/Mexico_City'),
  c('Monterrey, México', 'Monterrey', 25.6866, -100.3161, 'America/Monterrey'),
  c('Medellín, Colombia', 'Medellín', 6.2442, -75.5812, 'America/Bogota'),
  c('Quito, Ecuador', 'Quito', -0.1807, -78.4678, 'America/Guayaquil'),
  c('Caracas, Venezuela', 'Caracas', 10.4806, -66.9036, 'America/Caracas'),
  c('Montevideo, Uruguay', 'Montevideo', -34.9011, -56.1645, 'America/Montevideo'),
  c('Asunción, Paraguay', 'Asunción', -25.2637, -57.5759, 'America/Asuncion'),
  c('La Paz, Bolivia', 'La Paz', -16.4897, -68.1193, 'America/La_Paz'),
  c('San José, Costa Rica', 'San José', 9.9281, -84.0907, 'America/Costa_Rica'),
  c('Ciudad de Panamá, Panamá', 'Panamá', 8.9824, -79.5199, 'America/Panama'),
  c('La Habana, Cuba', 'La Habana', 23.1136, -82.3666, 'America/Havana'),
  c('San Juan, Puerto Rico', 'San Juan', 18.4655, -66.1057, 'America/Puerto_Rico'),
  c('Santo Domingo, Rep. Dominicana', 'Santo Domingo', 18.4861, -69.9312, 'America/Santo_Domingo'),
  c('San Pedro de Atacama, Chile', 'Atacama', -22.9087, -68.1997, 'America/Santiago'),
  c('Lisboa, Portugal', 'Lisboa', 38.7223, -9.1393, 'Europe/Lisbon'),
  c('París, Francia', 'París', 48.8566, 2.3522, 'Europe/Paris'),
  c('Londres, Reino Unido', 'Londres', 51.5074, -0.1278, 'Europe/London'),
  c('Roma, Italia', 'Roma', 41.9028, 12.4964, 'Europe/Rome'),
  c('Berlín, Alemania', 'Berlín', 52.52, 13.405, 'Europe/Berlin'),
  c('Reikiavik, Islandia', 'Reikiavik', 64.1466, -21.9426, 'Atlantic/Reykjavik'),
  c('Nueva York, EE. UU.', 'Nueva York', 40.7128, -74.006, 'America/New_York'),
  c('Los Ángeles, EE. UU.', 'Los Ángeles', 34.0522, -118.2437, 'America/Los_Angeles'),
  c('São Paulo, Brasil', 'São Paulo', -23.5505, -46.6333, 'America/Sao_Paulo'),
  c('Tokio, Japón', 'Tokio', 35.6762, 139.6503, 'Asia/Tokyo'),
  c('Sídney, Australia', 'Sídney', -33.8688, 151.2093, 'Australia/Sydney'),
  c('Ciudad del Cabo, Sudáfrica', 'Ciudad del Cabo', -33.9249, 18.4241, 'Africa/Johannesburg'),
];

export function searchLocal(q: string): Location[] {
  const n = normalize(q);
  if (!n) return [];
  return CITIES.filter(l => normalize(l.name).includes(n)).slice(0, 6);
}

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface GeoResult { name: string; latitude: number; longitude: number; timezone?: string; country?: string; admin1?: string }

/** Open-Meteo geocoding: free, no key. Only used when online. */
export async function searchOnline(q: string, signal: AbortSignal): Promise<Location[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=es&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(String(res.status));
  const data: { results?: GeoResult[] } = await res.json();
  return (data.results ?? []).map(r => c(
    [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : '', r.country].filter(Boolean).join(', '),
    r.name, r.latitude, r.longitude, r.timezone || 'UTC',
  ));
}
