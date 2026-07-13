/**
 * ADR-UI-001 component dimension standards: Buttons, Input Fields, Cards,
 * Bottom Sheets, Dialogs, Lists. Pairs with src/theme/tokens.ts (spacing,
 * color, typography, icon, radius scales).
 */

export const button = {
  primaryH: 56,
  secondaryH: 48,
  smallH: 40,
} as const;

export const input = {
  h: 56,
  labelGap: 8,
} as const;

export const card = {
  radius: 16,
  padding: 16,
} as const;

export const sheet = {
  radius: 28,
  padding: 24,
} as const;

export const dialog = {
  radius: 24,
  widthPct: 90,
} as const;

export const list = {
  rowH: 64,
} as const;
