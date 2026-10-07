import { phasePath } from '../astro/sky';

/**
 * Drawn Moon phase: base disc at text.1 @14 % plus the lit area. In the southern
 * hemisphere the Moon is seen mirrored, so the lit limb flips.
 */
export function MoonPhaseIcon({ fraction, waxing, south = false, size = 40 }: { fraction: number; waxing: boolean; south?: boolean; size?: number }) {
  return (
    <svg viewBox="-14 -14 28 28" width={size} height={size} className="moon-icon" aria-hidden="true">
      <circle r="12" fill="#E8ECF4" opacity="0.14" />
      <path d={phasePath(fraction, waxing !== south, 12)} fill="#F2EFE6" />
    </svg>
  );
}
