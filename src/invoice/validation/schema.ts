import { DocumentTheme } from '../themes/document-theme';

export interface ValidationWarning {
  readonly path: string;
  readonly message: string;
}

/**
 * validateSchema: Verifies type safety, properties, and bounds of a raw JSON theme object.
 * Preserves omitted properties as undefined, strips unknown keys, and reports warnings.
 */
export function validateSchema(
  rawJson: any,
  env: 'development' | 'production' = 'production'
): { readonly validPayload: DocumentTheme; readonly warnings: readonly ValidationWarning[] } {
  const warnings: ValidationWarning[] = [];
  const clean: any = {};

  if (!rawJson || typeof rawJson !== 'object') {
    warnings.push({ path: 'root', message: 'Theme payload must be an object' });
    const emptyTheme: DocumentTheme = {
      meta: { version: 1, id: 'fallback', name: 'Fallback', isSystem: true },
      style: { fontFamily: 'Inter', accentColor: '#F97316', density: 'comfortable' as any, borderRadius: 'rounded-md' as any },
      table: { style: 'minimal' as any, density: 'comfortable' as any },
    };
    return { validPayload: emptyTheme, warnings };
  }

  // ─── 1. Validate meta ───
  clean.meta = {};
  if (rawJson.meta && typeof rawJson.meta === 'object') {
    const m = rawJson.meta;
    clean.meta.version = typeof m.version === 'number' ? m.version : 1;
    clean.meta.id = typeof m.id === 'string' ? m.id.trim() : 'custom';
    clean.meta.name = typeof m.name === 'string' ? m.name.trim() : 'Custom Theme';
    clean.meta.isSystem = typeof m.isSystem === 'boolean' ? m.isSystem : false;

    for (const k of Object.keys(m)) {
      if (!['version', 'id', 'name', 'isSystem'].includes(k)) {
        if (env === 'development') {
          warnings.push({ path: `meta.${k}`, message: `Unknown meta property '${k}' was stripped` });
        }
      }
    }
  } else {
    // If meta is absent, it remains empty in overrides
    clean.meta = undefined;
  }

  // ─── 2. Validate style ───
  clean.style = {};
  if (rawJson.style && typeof rawJson.style === 'object') {
    const s = rawJson.style;

    // FontFamily
    const validFonts = ['sans-serif', 'serif', 'monospace', 'Inter', 'Georgia', 'Roboto', 'Helvetica Neue', 'Arial'];
    if (s.fontFamily !== undefined) {
      if (typeof s.fontFamily === 'string' && validFonts.includes(s.fontFamily)) {
        clean.style.fontFamily = s.fontFamily;
      } else {
        clean.style.fontFamily = 'Inter';
        warnings.push({ path: 'style.fontFamily', message: `Unsupported font '${s.fontFamily}' replaced with 'Inter'` });
      }
    }

    // AccentColor
    if (s.accentColor !== undefined) {
      if (typeof s.accentColor === 'string') {
        clean.style.accentColor = s.accentColor;
      } else {
        clean.style.accentColor = '#F97316';
        warnings.push({ path: 'style.accentColor', message: `Invalid accentColor. Defaulting to '#F97316'.` });
      }
    }

    // Density
    const validDensities = ['compact', 'comfortable', 'spacious'];
    if (s.density !== undefined) {
      if (typeof s.density === 'string' && validDensities.includes(s.density)) {
        clean.style.density = s.density;
      } else {
        clean.style.density = 'comfortable';
        warnings.push({ path: 'style.density', message: `Invalid density value '${s.density}' fallback to 'comfortable'` });
      }
    }

    // BorderRadius
    const validBorderRadii = ['none', 'square', 'rounded-sm', 'rounded-md', 'rounded-lg'];
    if (s.borderRadius !== undefined) {
      if (typeof s.borderRadius === 'string' && validBorderRadii.includes(s.borderRadius)) {
        clean.style.borderRadius = s.borderRadius;
      } else {
        clean.style.borderRadius = 'rounded-md';
        warnings.push({ path: 'style.borderRadius', message: `Invalid borderRadius '${s.borderRadius}' fallback to 'rounded-md'` });
      }
    }

    for (const k of Object.keys(s)) {
      if (!['fontFamily', 'accentColor', 'density', 'borderRadius'].includes(k)) {
        if (env === 'development') {
          warnings.push({ path: `style.${k}`, message: `Unknown style property '${k}' was stripped` });
        }
      }
    }
  } else {
    // If style is absent, it remains empty in overrides
    clean.style = undefined;
  }

  // ─── 3. Validate table ───
  clean.table = {};
  if (rawJson.table && typeof rawJson.table === 'object') {
    const t = rawJson.table;

    // TableStyle
    const validStyles = ['minimal', 'striped', 'bordered'];
    if (t.style !== undefined) {
      if (typeof t.style === 'string' && validStyles.includes(t.style)) {
        clean.table.style = t.style;
      } else {
        clean.table.style = 'minimal';
        warnings.push({ path: 'table.style', message: `Invalid table style '${t.style}' fallback to 'minimal'` });
      }
    }

    // Table Density
    const validDensities = ['compact', 'comfortable', 'spacious'];
    if (t.density !== undefined) {
      if (typeof t.density === 'string' && validDensities.includes(t.density)) {
        clean.table.density = t.density;
      } else {
        clean.table.density = 'comfortable';
        warnings.push({ path: 'table.density', message: `Invalid table density '${t.density}' fallback to 'comfortable'` });
      }
    }

    for (const k of Object.keys(t)) {
      if (!['style', 'density'].includes(k)) {
        if (env === 'development') {
          warnings.push({ path: `table.${k}`, message: `Unknown table property '${k}' was stripped` });
        }
      }
    }
  } else {
    // If table is absent, it remains empty in overrides
    clean.table = undefined;
  }

  // Strip all other unknown top-level keys
  for (const k of Object.keys(rawJson)) {
    if (!['meta', 'style', 'table'].includes(k)) {
      if (env === 'development') {
        warnings.push({ path: k, message: `Unknown top-level property '${k}' was stripped` });
      }
    }
  }

  return { validPayload: clean as DocumentTheme, warnings };
}
