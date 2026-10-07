import { useEffect, useState, useSyncExternalStore } from 'react';

function mediaStore(query: string) {
  return {
    subscribe(cb: () => void) {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    get: () => window.matchMedia(query).matches,
  };
}

const stores = new Map<string, ReturnType<typeof mediaStore>>();
export function useMedia(query: string) {
  let s = stores.get(query);
  if (!s) { s = mediaStore(query); stores.set(query, s); }
  return useSyncExternalStore(s.subscribe, s.get);
}

export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
export const prefersReduced = () => window.matchMedia(REDUCED_QUERY).matches;
export const useReducedMotion = () => useMedia(REDUCED_QUERY);
export const useIsMobile = () => useMedia('(max-width: 767px)');

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}
