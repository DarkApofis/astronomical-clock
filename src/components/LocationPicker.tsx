import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { Location } from '../astro/sky';
import { POPULAR_CITIES, normalize, searchLocal, searchOnline } from '../lib/cities';
import { prefersReduced } from '../lib/hooks';

export type GeoState = 'idle' | 'pending' | 'denied' | 'unavailable' | 'ok';

export function LocationPicker({ required, geo, online, onUseGeo, onPick, onClose }: {
  required: boolean;
  geo: GeoState;
  online: boolean;
  onUseGeo: () => void;
  onPick: (l: Location) => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);

  useLayoutEffect(() => {
    if (!root.current) return;
    if (prefersReduced()) gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none' });
    else gsap.fromTo(root.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' });
  }, []);

  useEffect(() => {
    if (required) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [required, onClose]);

  useEffect(() => {
    setRemote([]);
    if (!online || normalize(q).length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      searchOnline(q, ctrl.signal).then(setRemote).catch(() => {}).finally(() => setSearching(false));
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, online]);

  const local = searchLocal(q);
  const seen = new Set(local.map(l => normalize(l.name)));
  const results = [...local, ...remote.filter(l => !seen.has(normalize(l.name)))].slice(0, 6);

  return (
    <div className="picker-backdrop" onClick={e => { if (!required && e.target === e.currentTarget) onClose(); }}>
      <div ref={root} className="surface picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <div className="picker-head">
          <div className="picker-copy">
            <div className="eyebrow">UBICACIÓN</div>
            <div id="picker-title" className="picker-title">¿Desde dónde miras el cielo?</div>
            <p className="body-text">Cielo calcula todo en tu dispositivo. Tu ubicación no sale de él.</p>
          </div>
          {!required && <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}><span className="x" aria-hidden="true" /></button>}
        </div>
        <button type="button" className="btn btn-primary btn-40" onClick={onUseGeo} disabled={geo === 'pending'}>
          {geo === 'pending' ? 'Localizando…' : 'Usar mi ubicación'}
        </button>
        {geo === 'denied' && <p className="picker-note">El navegador no tiene permiso de ubicación. Actívalo en sus ajustes o elige una ciudad.</p>}
        {geo === 'unavailable' && <p className="picker-note">No se pudo obtener tu ubicación. Elige una ciudad.</p>}
        <div className="picker-cities">
          <div className="label-dim">O elige una ciudad</div>
          <div className="chips">
            {POPULAR_CITIES.map(c => (
              <button key={c.name} type="button" className="chip" onClick={() => onPick(c)}>{c.name.split(',')[0]}</button>
            ))}
          </div>
          <input ref={input} className="input" type="search" placeholder="Buscar ciudad" value={q}
            onChange={e => setQ(e.target.value)} aria-label="Buscar ciudad" autoComplete="off" />
          {q && (
            <ul className="results" role="listbox" aria-label="Resultados">
              {results.map(r => (
                <li key={`${r.name}${r.lat}`}>
                  <button type="button" className="result" onClick={() => onPick(r)}>
                    <span>{r.name}</span>
                    <span className="mono dim small">{r.lat.toFixed(2)}°, {r.lon.toFixed(2)}°</span>
                  </button>
                </li>
              ))}
              {!results.length && <li className="result-empty">{searching ? 'Buscando…' : online ? 'Sin resultados' : 'Sin conexión: solo ciudades guardadas'}</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
