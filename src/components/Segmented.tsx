import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReduced } from '../lib/hooks';

export interface SegOption<T extends string> { value: T; label: string; disabled?: boolean; title?: string }

/**
 * Segmented control. The active indicator is a single element that moves between
 * segments (220 ms, expo.out); label colour switches instantly.
 */
export function Segmented<T extends string>({ options, value, onChange, size = 'md', stretch = false, label, mono = false, className }: {
  options: SegOption<T>[]; value: T; onChange: (v: T) => void;
  size?: 'md' | 'sm'; stretch?: boolean; label: string; mono?: boolean; className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const ind = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const place = () => {
      const r = root.current, el = r?.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!r || !el || !ind.current) return;
      // width rather than scaleX keeps the 6 px corner radius undistorted; it's one small element.
      const vars = { x: el.offsetLeft, width: el.offsetWidth };
      if (first.current || prefersReduced()) gsap.set(ind.current, vars);
      else gsap.to(ind.current, { ...vars, duration: 0.22, ease: 'expo.out', overwrite: true });
      first.current = false;
    };
    place();
    const ro = new ResizeObserver(() => { first.current = true; place(); });
    if (root.current) ro.observe(root.current);
    document.fonts?.ready.then(() => { first.current = true; place(); });
    return () => ro.disconnect();
  }, [value]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const enabled = options.filter(o => !o.disabled);
    const i = enabled.findIndex(o => o.value === value);
    const next = enabled[(i + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    onChange(next.value);
    e.preventDefault();
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  return (
    <div ref={root} role="radiogroup" aria-label={label} onKeyDown={onKey}
      className={`seg seg-${size} ${stretch ? 'seg-stretch' : ''} ${mono ? 'mono' : ''} ${className ?? ''}`}>
      <span ref={ind} className="seg-ind" aria-hidden="true" />
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1} disabled={o.disabled} title={o.title}
          className="seg-item" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
