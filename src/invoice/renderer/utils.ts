import { InvoiceItemData } from './invoice-data';
import { DateFormat } from '../themes/design-tokens';
import { formatCurrencyHtml, formatDateByToken } from '../../services/formatService';

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
  return formatCurrencyHtml(n);
}

/**
 * fmtDate: Converts ISO strings per the business's configured date format preference.
 */
export function fmtDate(iso: string, format: DateFormat = 'DD MMMM YYYY'): string {
  try {
    if (isNaN(new Date(iso).getTime())) return esc(iso);
    return formatDateByToken(iso, format);
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
