function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Cross-platform card shadow: boxShadow (iOS/web) + elevation (Android). Replaces the deprecated shadow* props. */
export function cardShadow(
  color: string,
  offsetY: number,
  opacity: number,
  radius: number,
  opts: { offsetX?: number; elevation?: number } = {}
) {
  const { offsetX = 0, elevation = Math.round(offsetY) } = opts;
  return {
    boxShadow: `${offsetX}px ${offsetY}px ${radius}px ${withAlpha(color, opacity)}`,
    elevation,
  };
}

/**
 * ADR-UI-001 shadow tiers: none/low/medium, built on cardShadow() so every
 * screen pulls from the same three presets instead of inventing its own
 * offset/opacity/radius numbers per call site.
 */
export const shadowLevel = {
  none: undefined,
  low: cardShadow('#000', 1, 0.05, 8, { elevation: 1 }),
  medium: cardShadow('#000', 4, 0.10, 16, { elevation: 4 }),
} as const;
