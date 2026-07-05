import { DocumentTheme } from '../themes/document-theme';

/**
 * normalizeTheme: Trims, capitalises hex colors, and handles casing for design tokens.
 * Supports partial overrides without throwing null pointer exceptions.
 */
export function normalizeTheme(theme: DocumentTheme): DocumentTheme {
  const norm = JSON.parse(JSON.stringify(theme)); // Deep copy

  // Normalize Hex colors to upper case with prefix
  if (norm.style && typeof norm.style.accentColor === 'string') {
    let color = norm.style.accentColor.trim();
    if (color && !color.startsWith('#')) {
      color = '#' + color;
    }
    norm.style.accentColor = color.toUpperCase();
  }

  // Normalize font names to exact capitalization cases
  if (norm.style && typeof norm.style.fontFamily === 'string') {
    const f = norm.style.fontFamily.trim().toLowerCase();
    if (f === 'sans-serif' || f === 'sansserif') norm.style.fontFamily = 'sans-serif';
    else if (f === 'serif') norm.style.fontFamily = 'serif';
    else if (f === 'monospace') norm.style.fontFamily = 'monospace';
    else if (f === 'inter') norm.style.fontFamily = 'Inter';
    else if (f === 'georgia') norm.style.fontFamily = 'Georgia';
    else if (f === 'roboto') norm.style.fontFamily = 'Roboto';
    else if (f === 'helvetica neue' || f === 'helveticaneue' || f === 'helvetica') norm.style.fontFamily = 'Helvetica Neue';
    else if (f === 'arial') norm.style.fontFamily = 'Arial';
  }

  if (norm.style && typeof norm.style.density === 'string') {
    norm.style.density = norm.style.density.trim().toLowerCase() as any;
  }

  if (norm.style && typeof norm.style.borderRadius === 'string') {
    norm.style.borderRadius = norm.style.borderRadius.trim().toLowerCase() as any;
  }

  if (norm.table && typeof norm.table.style === 'string') {
    norm.table.style = norm.table.style.trim().toLowerCase() as any;
  }

  if (norm.table && typeof norm.table.density === 'string') {
    norm.table.density = norm.table.density.trim().toLowerCase() as any;
  }

  return norm as DocumentTheme;
}
