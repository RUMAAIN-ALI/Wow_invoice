import { DateFormat } from '../invoice/themes/design-tokens';

/**
 * Single source of truth for date/time/currency/number/filename formatting.
 * Every screen, PDF renderer, and export should call these instead of
 * formatting inline — see MEMORY.md / project history for why this module
 * exists (formatting had drifted into ~8 divergent currency implementations
 * and ~10 divergent date implementations across the app).
 */

// ─── Currency ─────────────────────────────────────────────────────────────
// Canonical input unit is rupees (float). Paise variants divide first, since
// the DB stores money as integer paise but on-screen amounts are rupee floats.

export function formatCurrency(rupees: number): string {
  return '₹' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrencyHtml(rupees: number): string {
  return '&#8377;' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrencyFromPaise(paise: number): string {
  return formatCurrency(paise / 100);
}

export function formatCurrencyFromPaiseHtml(paise: number): string {
  return formatCurrencyHtml(paise / 100);
}

// ─── Numbers ──────────────────────────────────────────────────────────────

export function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Whole quantities show no decimals (e.g. "10 pcs"); fractional ones keep up to 2 (e.g. "2.5 kg"). */
export function formatQuantity(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString('en-IN')
    : n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function formatPercent(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

// ─── Dates & times ────────────────────────────────────────────────────────

const MONTHS      = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS    = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dateParts(iso: string) {
  const d = new Date(iso);
  return { d, day: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
}

/** App-wide standard display date: "05 Jul 2026". Used for all screen UI. */
export function formatDate(iso: string): string {
  const { day, month, year } = dateParts(iso);
  return `${pad2(day)} ${MONTHS[month]} ${year}`;
}

/** "05 July 2026" — used on printed documents when the business prefers a spelled-out month. */
export function formatDateLong(iso: string): string {
  const { day, month, year } = dateParts(iso);
  return `${pad2(day)} ${MONTHS_FULL[month]} ${year}`;
}

export function formatDateSlash(iso: string): string {
  const { day, month, year } = dateParts(iso);
  return `${pad2(day)}/${pad2(month + 1)}/${year}`;
}

export function formatDateDash(iso: string): string {
  const { day, month, year } = dateParts(iso);
  return `${pad2(day)}-${pad2(month + 1)}-${year}`;
}

/** ISO 8601, "2026-07-05" — also the canonical storage format. */
export function formatDateIso(iso: string): string {
  const { day, month, year } = dateParts(iso);
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** "Sunday, 05 July" — used for greeting-style headers (e.g. Home screen). */
export function formatDateWeekday(iso: string): string {
  const { d, day, month } = dateParts(iso);
  return `${WEEKDAYS[d.getDay()]}, ${pad2(day)} ${MONTHS_FULL[month]}`;
}

/** "July 2026" — used for month-grouped section headers and report labels. */
export function formatMonthYear(iso: string): string {
  const { month, year } = dateParts(iso);
  return `${MONTHS_FULL[month]} ${year}`;
}

/** "July" — from a 1-12 month number, used for month-drilldown headers. */
export function formatMonthName(monthNum: number): string {
  return MONTHS_FULL[monthNum - 1] ?? '';
}

/** 24-hour clock, "14:35". */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "2026-07-05 14:35:42" — canonical timestamp for logs/exports. */
export function formatTimestamp(iso: string): string {
  const { d, day, month, year } = dateParts(iso);
  return `${year}-${pad2(month + 1)}-${pad2(day)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** "05 Jul 2026, 14:35" — display date + time together. */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/**
 * Resolves a business's configured DateFormat preference to the matching
 * formatter. Printed documents stay per-business-configurable (theme.dateFormat);
 * everything else in the app uses the fixed formatDate() standard above.
 */
export function formatDateByToken(iso: string, token: DateFormat): string {
  switch (token) {
    case 'DD/MM/YYYY':   return formatDateSlash(iso);
    case 'DD-MM-YYYY':   return formatDateDash(iso);
    case 'YYYY-MM-DD':   return formatDateIso(iso);
    case 'DD MMMM YYYY': return formatDateLong(iso);
    default:              return formatDate(iso);
  }
}

// ─── File naming ──────────────────────────────────────────────────────────

function sanitizeForFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '').trim();
}

/** "Invoice_INV-2026-000123_Ramesh_2026-07-05.pdf" */
export function formatFileName(
  docTypeName: string,
  docNumber: string,
  customerName: string | undefined,
  dateIso: string,
  ext: string
): string {
  const segments = [sanitizeForFileName(docTypeName), sanitizeForFileName(docNumber)];
  if (customerName) segments.push(sanitizeForFileName(customerName));
  segments.push(formatDateIso(dateIso));
  return `${segments.join('_')}.${ext}`;
}
