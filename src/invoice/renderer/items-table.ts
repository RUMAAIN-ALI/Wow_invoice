import { ResolvedTheme } from '../themes/resolved-theme';
import { InvoiceItemData } from './invoice-data';
import { esc, fmt, getTaxable } from './utils';

/**
 * renderItemsTable: Generates the structured HTML table of items.
 * Handles both GST-compliant 8-column tables and standard 5-column tables
 * depending on item taxation status, mapping cell paddings from density.
 */
export function renderItemsTable(
  templateId: string,
  theme: ResolvedTheme,
  items: readonly InvoiceItemData[]
): string {
  if (!items || items.length === 0) return '';

  const hasGst = theme.showGstPct && items.some(r => (r.gstPct ?? 0) > 0);
  const hasHsn = theme.showHsn && items.some(r => r.hsn);
  const hasUnit = theme.showUnit;

  const cellPadding = theme.tableCellPadding;
  const isStriped = theme.tableStyle === 'striped';
  const isBordered = theme.tableStyle === 'bordered';
  const borderStyle = isBordered ? 'border:1px solid #ddd;' : '';

  if (templateId === 'thermal') {
    // Single-column stacked receipt rows — no wide table, fits 58/80mm paper.
    return `
<div class="thm-items">
  ${items.map(r => {
    const tv  = getTaxable(r);
    const pct = r.gstPct ?? 0;
    const amt = hasGst ? tv * (1 + pct / 100) : tv;
    return `
  <div class="thm-item-row">
    <div class="thm-item-name">${esc(r.name)}</div>
    <div class="thm-item-line">
      <span>${r.qty} x ${fmt(r.price)}</span>
      <span>${fmt(amt)}</span>
    </div>
  </div>`;
  }).join('')}
</div>`;
  }

  if (templateId === 'minimal') {
    // Minimal design: B&W, ruled top/bottom borders, hardcoded minimal template cell paddings
    return `
<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;margin-top:8px">
  <thead>
    <tr style="border-top:1.5px solid #111;border-bottom:1.5px solid #111">
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;padding:8px 0;text-align:center;width:28px">#</th>
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;padding:8px 10px;text-align:left">Description</th>
      ${hasHsn ? `<th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;padding:8px 0;text-align:left;width:56px">HSN</th>` : ''}
      ${hasUnit ? `<th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;padding:8px 0;text-align:right;width:44px">Unit</th>` : ''}
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;padding:8px 0;text-align:right;width:52px">Qty</th>
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;padding:8px 0;text-align:right;width:90px">Rate</th>
      ${hasGst ? `<th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;padding:8px 0;text-align:right;width:80px">Taxable</th><th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;padding:8px 0;text-align:right;width:44px">GST%</th>` : ''}
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555;padding:8px 0;text-align:right;width:100px">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${items.map((r, i) => {
      const tv  = getTaxable(r);
      const pct = r.gstPct ?? 0;
      const amt = tv * (1 + pct / 100);
      return `
    <tr style="border-bottom:1px solid #ebebeb">
      <td style="padding:9px 0;text-align:center;color:#aaa;font-size:11px">${i + 1}</td>
      <td style="padding:9px 10px;font-size:13px;font-weight:500">${esc(r.name)}</td>
      ${hasHsn ? `<td style="padding:9px 0;font-size:12px;color:#555">${esc(r.hsn ?? '')}</td>` : ''}
      ${hasUnit ? `<td style="padding:9px 0;text-align:right;font-size:12px">${esc(r.unit ?? 'NOS')}</td>` : ''}
      <td style="padding:9px 0;text-align:right;font-size:13px">${r.qty}</td>
      <td style="padding:9px 0;text-align:right;font-size:13px">${fmt(r.price)}</td>
      ${hasGst ? `<td style="padding:9px 0;text-align:right;font-size:13px">${fmt(tv)}</td><td style="padding:9px 0;text-align:right;font-size:12px;color:#555">${pct > 0 ? pct + '%' : '—'}</td>` : ''}
      <td style="padding:9px 0;text-align:right;font-size:13px;font-weight:600">${fmt(hasGst ? amt : tv)}</td>
    </tr>`;
    }).join('')}
  </tbody>
</table>`;
  }

  // Classic/Modern styled table
  const isModern = templateId === 'modern';
  const brand = theme.accentColor;
  
  const hBg = isModern ? '#F6F8FA' : brand;
  const hColor = isModern ? '#111' : '#fff';
  const bColor = isModern ? '#eaeaea' : '#eee';

  const H = (txt: string, w?: string) =>
    `<th style="background:${hBg};color:${hColor};font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:${cellPadding};text-align:left${w ? ';width:' + w : ''}">${txt}</th>`;
  
  const Hr = (txt: string, w?: string) =>
    `<th style="background:${hBg};color:${hColor};font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:${cellPadding};text-align:right${w ? ';width:' + w : ''}">${txt}</th>`;
  
  const C = (txt: string, right = false, bold = false) =>
    `<td style="padding:${cellPadding};font-size:12.5px;border-bottom:1px solid ${bColor}${right ? ';text-align:right' : ''}${bold ? ';font-weight:600' : ''}">${txt}</td>`;

  if (!hasGst) {
    // 5-column table
    return `
<table style="width:100%;border-collapse:collapse;${isBordered ? 'border:1px solid #ddd;' : ''}">
  <thead><tr>
    ${H('#','28px')}${H('Description')}${hasHsn ? H('HSN','60px') : ''}${Hr('Qty','60px')}${Hr('Rate','90px')}${Hr('Amount','100px')}
  </tr></thead>
  <tbody>
    ${items.map((r, i) => {
      const rowStyle = (isStriped && i % 2 === 1) ? 'background:#f8f9fa;' : '';
      return `
    <tr style="${rowStyle}">
      ${C(String(i + 1))}
      ${C(esc(r.name), false, true)}
      ${hasHsn ? C(esc(r.hsn ?? '—')) : ''}
      ${C(String(r.qty), true)}
      ${C(fmt(r.price), true)}
      ${C(fmt(getTaxable(r)), true, true)}
    </tr>`;
    }).join('')}
  </tbody>
</table>`;
  }

  // GST-compliant 8-column table
  return `
<table style="width:100%;border-collapse:collapse;${isBordered ? 'border:1px solid #ddd;' : ''}">
  <thead><tr>
    ${H('#','24px')}${H('Description')}${hasHsn ? H('HSN','56px') : ''}${Hr('Qty','48px')}${hasUnit ? Hr('Unit','44px') : ''}${Hr('Rate','80px')}${hasGst ? Hr('Taxable','84px') : ''}${hasGst ? Hr('GST%','44px') : ''}${Hr('Amount','90px')}
  </tr></thead>
  <tbody>
    ${items.map((r, i) => {
      const tv  = getTaxable(r);
      const pct = r.gstPct ?? 0;
      const amt = tv * (1 + pct / 100);
      const rowStyle = (isStriped && i % 2 === 1) ? 'background:#f8f9fa;' : '';
      return `
    <tr style="${rowStyle}">
      ${C(String(i + 1))}
      ${C(esc(r.name), false, true)}
      ${hasHsn ? C(esc(r.hsn ?? '')) : ''}
      ${C(String(r.qty), true)}
      ${hasUnit ? C(esc(r.unit ?? 'NOS'), true) : ''}
      ${C(fmt(r.price), true)}
      ${hasGst ? C(fmt(tv), true) : ''}
      ${hasGst ? C(pct > 0 ? pct + '%' : '—', true) : ''}
      ${C(fmt(amt), true, true)}
    </tr>`;
    }).join('')}
  </tbody>
</table>`;
}
