import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEEDS = [1, 60, 3600] as const;
export type Speed = (typeof SPEEDS)[number];

const MIN_T = Date.UTC(1000, 0, 1);
const MAX_T = Date.UTC(3000, 0, 1);
const clampT = (t: number) => Math.min(MAX_T, Math.max(MIN_T, t));

/**
 * Simulated time. While playing, time advances `speed`× real time on rAF.
 * At 1× React only re-renders when the displayed second changes.
 */
export function useSimClock() {
  const [time, setTimeState] = useState(() => Date.now());
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeedState] = useState<Speed>(1);
  const anchor = useRef({ sim: time, real: performance.now() });
  const timeRef = useRef(time);

  const commit = useCallback((t: number) => {
    timeRef.current = t;
    setTimeState(t);
  }, []);

  const reanchor = useCallback((sim: number) => {
    anchor.current = { sim, real: performance.now() };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    reanchor(timeRef.current);
    const loop = () => {
      const a = anchor.current;
      const t = clampT(a.sim + (performance.now() - a.real) * speed);
      if (speed > 1 || Math.floor(t / 1000) !== Math.floor(timeRef.current / 1000)) commit(t);
      else timeRef.current = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, commit, reanchor]);

  const setTime = useCallback((t: number) => {
    const c = clampT(t);
    reanchor(c);
    commit(c);
  }, [commit, reanchor]);

  const setSpeed = useCallback((s: Speed) => {
    reanchor(timeRef.current);
    setSpeedState(s);
  }, [reanchor]);

  const now = useCallback(() => {
    setTime(Date.now());
    setSpeedState(1);
    setPlaying(true);
  }, [setTime]);

  return { time, timeRef, playing, setPlaying, speed, setSpeed, setTime, now };
}
