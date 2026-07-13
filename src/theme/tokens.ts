/**
 * ADR-UI-001 Foundation layer: the single source of truth for app-wide
 * spacing, color, typography, icon, radius, touch-target, and motion
 * scales. New code should import from here rather than defining local
 * `const C = {...}` palettes per screen (see src/constants/index.ts's
 * COLORS/MD3 for the legacy tokens this supersedes going forward).
 *
 * Not to be confused with src/invoice/themes/design-tokens.ts, which
 * describes document/PDF rendering style options, not app UI pixel values.
 */

// 8pt grid
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Anchored to the existing canonical values already live in App.tsx's
// PaperProvider theme and src/constants/index.ts's COLORS, not invented.
export const colors = {
  primary: '#F97316',
  primaryDark: '#EA580C',
  secondary: '#64748B',
  success: '#22C55E',
  error: '#DC2626',
  warning: '#D97706',
  surface: '#FFFFFF',
  background: '#F8FAFC',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#9CA3AF',
} as const;

export const typography = {
  xxl: 28,
  xl: 20,
  lg: 18,
  md: 16,
  sm: 14,
  xs: 12,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

// New standard per ADR-UI-001 — supersedes constants/index.ts's MD3.radius
// ({xs:8, sm:12, md:16, lg:20, full:999}) going forward. MD3.radius is left
// untouched for now; screens still using it are migrated separately.
export const radius = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 24,
  xxl: 28,
} as const;

export const touchTarget = {
  min: 48,
} as const;

export const motion = {
  tap: 100,
  sheetOpen: 250,
  sheetClose: 200,
  page: 300,
} as const;
