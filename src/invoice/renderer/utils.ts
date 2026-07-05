import { InvoiceItemData } from './invoice-data';

/**
 * esc: Escapes HTML special characters to prevent rendering bugs and injection vulnerabilities.
 */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * fmt: Formats numerical values into Indian Rupee (INR) currency strings with Indian digit grouping.
 */
export function fmt(n: number): string {
  return '&#8377;' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * fmtDate: Converts ISO strings into readable local date format (e.g., "21 June 2026").
 */
export function fmtDate(iso: string, format: string = 'DD MMMM YYYY'): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return esc(iso);
    
    // For standard Indian locale representation matching legacy
    if (format === 'DD MMMM YYYY') {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return d.toLocaleDateString('en-IN');
  } catch {
    return esc(iso);
  }
}

/**
 * getTaxable: Computes taxable value for a row item (manual override or qty * price - discount).
 */
export function getTaxable(item: InvoiceItemData): number {
  if (item.taxableValue !== undefined && item.taxableValue >= 0) {
    return item.taxableValue;
  }
  return Math.max(0, Number(item.qty || 0) * Number(item.price || 0) - Number(item.discount || 0));
}
