import { ResolvedTheme } from '../themes/resolved-theme';
import { InvoiceItemData } from './invoice-data';
import { fmt, getTaxable } from './utils';

/**
 * renderTotals: Computes tax rate buckets and renders the totals summary block.
 * Determines if tax is Inter-state (IGST) or Intra-state (CGST + SGST) based on state matching.
 */
export function renderTotals(
  theme: ResolvedTheme,
  items: readonly InvoiceItemData[],
  sellerState?: string,
  customerState?: string,
  mono = false,
  templateId?: string
): string {
  if (!items || items.length === 0) return '';

  const hasGst = theme.showGstPct && items.some(r => (r.gstPct ?? 0) > 0);
  const isInterState = !!(sellerState && customerState &&
    sellerState.trim().toLowerCase() !== customerState.trim().toLowerCase());

  // Compute per-bucket tax totals
  const buckets = new Map<number, { taxable: number; tax: number }>();
  let grandTaxable = 0;
  let grandTax = 0;

  for (const item of items) {
    const tv  = getTaxable(item);
    const pct = Number(item.gstPct ?? 0);
    const tax = tv * (pct / 100);
    grandTaxable += tv;
    grandTax     += tax;
    
    if (pct > 0) {
      const b = buckets.get(pct) ?? { taxable: 0, tax: 0 };
      buckets.set(pct, { taxable: b.taxable + tv, tax: b.tax + tax });
    }
  }

  const grandTotal = grandTaxable + (theme.showGstPct ? grandTax : 0);
  const totalColor = '#111';
  
  // Helper to generate a light tint (8% opacity) of the brand color for a premium feel
  const hexToRgba = (hex: string, alpha: number) => {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return `rgba(0,0,0,0.05)`; // fallback
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };
  const bgTint = mono ? '#f8f8f8' : hexToRgba(theme.accentColor, 0.08);

  const rowStyle = (border = true) =>
    `display:flex;justify-content:space-between;padding:7px 14px;font-size:13px${border ? ';border-bottom:1px solid #f0f0f0' : ''}`;
  
  const boldRow  = `display:flex;justify-content:space-between;padding:12px 14px;font-size:16px;font-weight:700;background:${bgTint};color:${totalColor};border-radius:6px;margin-top:4px`;

  let taxRows = '';
  if (hasGst) {
    const sortedBuckets = [...buckets.entries()].sort(([a], [b]) => a - b);
    for (const [pct, { taxable, tax }] of sortedBuckets) {
      if (isInterState) {
        taxRows += `<div style="${rowStyle()}"><span>IGST @${pct}% <span style="color:#999;font-size:11px">(on ${fmt(taxable)})</span></span><span>${fmt(tax)}</span></div>`;
      } else {
        const half = tax / 2;
        taxRows += `<div style="${rowStyle()}"><span>CGST @${pct / 2}% <span style="color:#999;font-size:11px">(on ${fmt(taxable)})</span></span><span>${fmt(half)}</span></div>`;
        taxRows += `<div style="${rowStyle()}"><span>SGST @${pct / 2}%</span><span>${fmt(half)}</span></div>`;
      }
    }
    taxRows += `<div style="${rowStyle()}"><span style="font-weight:600">Total Tax</span><span style="font-weight:600">${fmt(grandTax)}</span></div>`;
  }

  if (templateId === 'thermal') {
    return `
<div style="margin-top:4px">
  <div style="${rowStyle()}"><span>Taxable Amount</span><span>${fmt(grandTaxable)}</span></div>
  ${taxRows}
  <div style="${boldRow.replace('border-radius:6px;', '')}"><span>TOTAL</span><span>${fmt(grandTotal)}</span></div>
</div>`;
  }

  return `
<div style="display:flex;justify-content:flex-end;margin-top:2px">
  <div style="width:320px">
    <div style="${rowStyle()}"><span>Taxable Amount</span><span>${fmt(grandTaxable)}</span></div>
    ${taxRows}
    <div style="${boldRow}"><span>Grand Total</span><span>${fmt(grandTotal)}</span></div>
  </div>
</div>`;
}
