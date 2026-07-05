import { Density, FontFamily, BorderRadius, TableStyle } from './design-tokens';
import { BusinessPreferences } from '../preferences/business-preferences';

/**
 * Theme Metadata: Schema version and identity of a visual appearance theme.
 */
export interface ThemeMetadata {
  readonly version: number;                // Incremented on backwards-incompatible changes
  readonly id: string;                     // Unique theme identifier e.g. "classic_blue", "luxury_gold"
  readonly name: string;
  readonly isSystem: boolean;              // True for built-in read-only themes, false for user overrides
}

/**
 * Document Theme: Immutable definition of visual appearance styles.
 * Separated from layout structure and business functional preferences.
 */
export interface DocumentTheme {
  readonly meta: ThemeMetadata;
  readonly style: {
    readonly fontFamily: FontFamily;
    readonly accentColor: string;          // Hex color code, e.g. "#1E3A8A"
    readonly density: Density;
    readonly borderRadius: BorderRadius;
  };
  readonly table: {
    readonly style: TableStyle;
    readonly density: Density;
  };
}

/**
 * Theme Patch: Partial modification representation of style overrides and business preferences.
 * AI prompt outputs and manual edits generate a patch which resolves against default configurations.
 */
export interface ThemePatch {
  readonly style?: Partial<DocumentTheme['style']>;
  readonly table?: Partial<DocumentTheme['table']>;
  readonly preferences?: Partial<BusinessPreferences>;
}
