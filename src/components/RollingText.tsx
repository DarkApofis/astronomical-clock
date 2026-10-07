import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReduced } from '../lib/hooks';

/**
 * Rolling counter: each character sits in its own column; a changed character rolls
 * vertically (y ±100 %, 240 ms, power2.out). Relies on tabular numerals so nothing shifts.
 */
export function RollingText({ text, dir = 1, className }: { text: string; dir?: 1 | -1; className?: string }) {
  return (
    <span className={`roll ${className ?? ''}`} aria-label={text} role="text">
      {Array.from(text).map((ch, i) => <RollChar key={i} ch={ch} dir={dir} />)}
    </span>
  );
}

function RollChar({ ch, dir }: { ch: string; dir: 1 | -1 }) {
  const prev = useRef(ch);
  const curEl = useRef<HTMLSpanElement>(null);
  const oldEl = useRef<HTMLSpanElement>(null);
  const lastChange = useRef(0);

  useLayoutEffect(() => {
    const old = prev.current;
    prev.current = ch;
    if (old === ch || !oldEl.current || !curEl.current) return;
    oldEl.current.textContent = old;
    const now = performance.now(), since = now - lastChange.current;
    lastChange.current = now;
    // Changes faster than the roll itself (fast playback, quick scrubs) would never settle: snap instead.
    if (prefersReduced() || since < 240) {
      gsap.killTweensOf([curEl.current, oldEl.current]);
      gsap.set(curEl.current, { yPercent: 0 });
      gsap.set(oldEl.current, { opacity: 0 });
      return;
    }
    const d = { duration: 0.24, ease: 'power2.out', overwrite: true };
    gsap.fromTo(curEl.current, { yPercent: 100 * dir }, { yPercent: 0, ...d });
    gsap.fromTo(oldEl.current, { yPercent: 0, opacity: 1 }, { yPercent: -100 * dir, opacity: 1, ...d });
  }, [ch, dir]);

  return (
    <span className="roll-col" aria-hidden="true">
      <span ref={oldEl} className="roll-old" style={{ opacity: 0 }} />
      <span ref={curEl} className="roll-cur">{ch}</span>
    </span>
  );
}
