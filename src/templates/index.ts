import { DocRecord, BusinessSettings } from '../types';
import { renderLegacyInput } from '../invoice/renderer/adapter';

export type DataMap = Record<string, any>;

export interface RenderInput {
  record: DocRecord;
  data: DataMap;
  docName: string;
  business: BusinessSettings;
  templateType?: 'transaction_document' | 'record_form';
  themeOverrides?: any;
  preferences?: any;
}

export interface RenderContext {
  blocks: {
    itemsTable: boolean;
    totals:     boolean;
    extras:     boolean;
  };
  business: BusinessSettings;
  document: {
    record: DocRecord;
    data:   DataMap;
    docName: string;
  };
}

export interface BuiltinDesign {
  id: string;
  name: string;
  description: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildContext(input: RenderInput): RenderContext {
  const isInvoiceLike = input.templateType === 'transaction_document' || !input.templateType;
  return {
    blocks: {
      itemsTable: isInvoiceLike,
      totals:     isInvoiceLike,
      extras:     true,
    },
    business: input.business,
    document: {
      record: input.record,
      data:   input.data,
      docName: input.docName,
    },
  };
}

interface Extracted {
  customerName:    string;
  customerState?:  string;
  itemRows:        any[];
  extraEntries:    Array<[string, any]>;
}

function extractData(data: DataMap): Extracted {
  const customerName = String(data['Customer Name'] ?? '');
  const customerState = data['Customer State'] ? String(data['Customer State']) : undefined;
  const itemRows = Array.isArray(data['Item Table']) ? data['Item Table'] : [];

  const extraEntries = Object.entries(data).filter(
    ([k, v]) => k !== 'Customer Name' && k !== 'Customer State' && !Array.isArray(v) && (v || v === 0)
  );

  return { customerName, customerState, itemRows, extraEntries };
}

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmt(n: any): string {
  const num = Number(n ?? 0);
  return '&#8377;' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: any): string {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getTaxable(item: any): number {
  const qty = Number(item.qty ?? 0);
  const rate = Number(item.price ?? 0);
  const disc = Number(item.discount ?? 0);
  const val = qty * rate;
  return Math.max(0, val - disc);
}

// ── AI Helper HTML Block Components ──────────────────────────────────────────

function itemsBlockInline(items: any[], brandColor: string): string {
  if (!items.length) return '';
  const hasGst = items.some(r => (r.gstPct ?? 0) > 0);
  const hasHsn = items.some(r => r.hsn);

  const H = (txt: string, w?: string) =>
    `<th style="background:${brandColor};color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:8px 10px;text-align:left${w ? ';width:' + w : ''}">${txt}</th>`;
  const Hr = (txt: string, w?: string) =>
    `<th style="background:${brandColor};color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:8px 10px;text-align:right${w ? ';width:' + w : ''}">${txt}</th>`;
  const C = (txt: string, right = false, bold = false) =>
    `<td style="padding:8px 10px;font-size:12.5px;border-bottom:1px solid #eee${right ? ';text-align:right' : ''}${bold ? ';font-weight:600' : ''}">${txt}</td>`;

  if (!hasGst) {
    return `
<table style="width:100%;border-collapse:collapse">
  <thead><tr>
    ${H('#','28px')}${H('Description')}${hasHsn ? H('HSN','60px') : ''}${Hr('Qty','60px')}${Hr('Rate','90px')}${Hr('Amount','100px')}
  </tr></thead>
  <tbody>
    ${items.filter(r => r.name).map((r, i) => `
    <tr>
      ${C(String(i + 1))}
      ${C(esc(r.name), false, true)}
      ${hasHsn ? C(esc(r.hsn ?? '—')) : ''}
      ${C(String(r.qty), true)}
      ${C(fmt(r.price), true)}
      ${C(fmt(getTaxable(r)), true, true)}
    </tr>`).join('')}
  </tbody>
</table>`;
  }

  return `
<table style="width:100%;border-collapse:collapse">
  <thead><tr>
    ${H('#','24px')}${H('Description')}${hasHsn ? H('HSN','56px') : ''}${Hr('Qty','48px')}${Hr('Unit','44px')}${Hr('Rate','80px')}${Hr('Taxable','84px')}${Hr('GST%','44px')}${Hr('Amount','90px')}
  </tr></thead>
  <tbody>
    ${items.filter(r => r.name).map((r, i) => {
      const tv  = getTaxable(r);
      const pct = r.gstPct ?? 0;
      const amt = tv * (1 + pct / 100);
      return `
    <tr>
      ${C(String(i + 1))}
      ${C(esc(r.name), false, true)}
      ${hasHsn ? C(esc(r.hsn ?? '')) : ''}
      ${C(String(r.qty), true)}
      ${C(esc(r.unit ?? 'NOS'), true)}
      ${C(fmt(r.price), true)}
      ${C(fmt(tv), true)}
      ${C(pct > 0 ? pct + '%' : '—', true)}
      ${C(fmt(amt), true, true)}
    </tr>`;
    }).join('')}
  </tbody>
</table>`;
}

function gstTotalsBlock(
  items:         any[],
  sellerState:   string | undefined,
  customerState: string | undefined,
  brand:         string,
  mono           = false,
): string {
  if (!items.length) return '';

  const hasGst      = items.some(r => (r.gstPct ?? 0) > 0);
  const isInterState = !!(sellerState && customerState &&
    sellerState.trim().toLowerCase() !== customerState.trim().toLowerCase());

  const buckets = new Map<number, { taxable: number; tax: number }>();
  let grandTaxable = 0;
  let grandTax     = 0;

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

  const grandTotal = grandTaxable + grandTax;
  const totalBrand = mono ? '#111' : brand;
  const totalColor = '#fff';

  const rowStyle = (border = true) =>
    `display:flex;justify-content:space-between;padding:7px 14px;font-size:13px${border ? ';border-bottom:1px solid #f0f0f0' : ''}`;
  const boldRow  = `display:flex;justify-content:space-between;padding:10px 14px;font-size:15px;font-weight:700;background:${totalBrand};color:${totalColor}`;

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

  return `
<div style="display:flex;justify-content:flex-end;margin-top:2px">
  <div style="width:320px">
    <div style="${rowStyle()}"><span>Taxable Amount</span><span>${fmt(grandTaxable)}</span></div>
    ${taxRows}
    <div style="${boldRow}"><span>Grand Total</span><span>${fmt(grandTotal)}</span></div>
  </div>
</div>`;
}

function paymentBlockInline(business: BusinessSettings): string {
  const hasUpi  = !!business.upiId;
  const hasBank = !!(business.bankName || business.accountNumber);
  if (!hasUpi && !hasBank) return '';

  const upiSection = hasUpi ? `
    <div style="flex:1;min-width:160px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:6px">Pay via UPI</div>
      <div style="font-size:13px;font-weight:600;color:#1a1a1a">${esc(business.upiId!)}</div>
    </div>` : '';

  const bankSection = hasBank ? `
    <div style="flex:1;min-width:160px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:6px">Bank Transfer</div>
      ${business.bankName    ? `<div style="font-size:12px;color:#333">${esc(business.bankName)}</div>` : ''}
      ${business.accountNumber ? `<div style="font-size:12px;color:#333">A/C: ${esc(business.accountNumber)}</div>` : ''}
      ${business.ifsc        ? `<div style="font-size:12px;color:#333">IFSC: ${esc(business.ifsc)}</div>` : ''}
    </div>` : '';

  return `
<div style="margin-top:20px;padding:14px 16px;border:1px solid #e8eaf0;border-radius:8px;background:#fafafa">
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:10px">Payment Details</div>
  <div style="display:flex;gap:24px;flex-wrap:wrap">
    ${upiSection}
    ${hasUpi && hasBank ? '<div style="width:1px;background:#e8eaf0;margin:0 4px"></div>' : ''}
    ${bankSection}
  </div>
</div>`;
}

function extrasBlockInline(entries: Array<[string, any]>): string {
  if (!entries.length) return '';
  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 40px;margin-top:22px;padding-top:18px;border-top:1px solid #eee">
  ${entries.map(([k, v]) => `
  <div>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#aaa;margin-bottom:3px">${esc(k)}</div>
    <div style="font-size:13px;color:#1a1a1a">${esc(String(v))}</div>
  </div>`).join('')}
</div>`;
}

function signatureBlock(bizName: string): string {
  return `
<div style="text-align:center">
  <div style="height:44px;border-bottom:1px solid #333;width:160px;margin:0 auto 6px"></div>
  <div style="font-size:12px;font-weight:600">${esc(bizName)}</div>
  <div style="font-size:10px;color:#999;margin-top:2px">Authorised Signatory</div>
</div>`;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const BUILTIN_DESIGNS: BuiltinDesign[] = [
  { id: 'classic',    name: 'Classic',           description: 'Two-column header with brand accent bar' },
  { id: 'modern',     name: 'Modern',            description: 'Full-width colour header band'  },
  { id: 'minimal',    name: 'Minimal',           description: 'Black & white, serif, elegant' },
  { id: 'letterhead', name: 'Letterhead',        description: 'Corporate letterhead with large header & formal signature' },
  { id: 'thermal',    name: 'Thermal / Compact', description: 'Single-column receipt for 58mm/80mm printers' },
];

// ── AI template rendering ─────────────────────────────────────────────────────

export function renderAiTemplate(rawHtml: string, input: RenderInput): string {
  const ctx = buildContext(input);
  const { record, docName, data } = ctx.document;
  const { business } = ctx;
  const brand = business.brandColor || '#F97316';
  const { customerName, customerState, itemRows, extraEntries } = extractData(data);

  const billToBlock = customerName
    ? `<div style="margin-bottom:18px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#aaa;margin-bottom:4px">BILL TO</div><div style="font-size:15px;font-weight:600">${esc(customerName)}</div></div>`
    : '';

  const contact = [
    business.phone ? 'Tel: ' + esc(business.phone) : '',
    business.email ? esc(business.email) : '',
  ].filter(Boolean).join(' | ');

  const bankBlock = (business.bankName || business.accountNumber || business.ifsc)
    ? [
        business.bankName      ? esc(business.bankName)      : '',
        business.accountNumber ? 'A/C: ' + esc(business.accountNumber) : '',
        business.ifsc          ? 'IFSC: ' + esc(business.ifsc)         : '',
      ].filter(Boolean).join(' &nbsp;|&nbsp; ')
    : '';

  return rawHtml
    .replace(/%%BUSINESS_NAME%%/g,    esc(business.name))
    .replace(/%%BUSINESS_ADDRESS%%/g, business.address ? esc(business.address).replace(/\n/g, '<br>') : '')
    .replace(/%%BUSINESS_GSTIN%%/g,   business.gstin ? 'GSTIN: ' + esc(business.gstin) : '')
    .replace(/%%BUSINESS_PHONE%%/g,   business.phone ? esc(business.phone) : '')
    .replace(/%%BUSINESS_EMAIL%%/g,   business.email ? esc(business.email) : '')
    .replace(/%%BUSINESS_CONTACT%%/g, contact)
    .replace(/%%BUSINESS_UPI%%/g,     business.upiId ? esc(business.upiId) : '')
    .replace(/%%BUSINESS_STATE%%/g,   business.stateName ? esc(business.stateName) : '')
    .replace(/%%BUSINESS_BANK%%/g,    bankBlock)
    .replace(/%%BUSINESS_LOGO%%/g,    business.logo ? `<img src="${esc(business.logo)}" style="max-height:60px;max-width:160px;object-fit:contain" alt="logo">` : '')
    .replace(/%%BUSINESS_TYPE%%/g,    business.type === 'other' && (business as any).customBusinessType
                                        ? esc((business as any).customBusinessType)
                                        : esc(business.type ?? ''))
    .replace(/%%DOC_TYPE%%/g,         esc(docName))
    .replace(/%%DOC_NUMBER%%/g,       esc(record.number))
    .replace(/%%DOC_DATE%%/g,         fmtDate(record.createdAt))
    .replace(/%%BILL_TO%%/g,          billToBlock)
    .replace(/%%ITEMS_TABLE%%/g,      ctx.blocks.itemsTable ? itemsBlockInline(itemRows, brand) : '')
    .replace(/%%TOTALS_BLOCK%%/g,     ctx.blocks.totals && itemRows.length ? gstTotalsBlock(itemRows, business.stateName, customerState, brand) : '')
    .replace(/%%PAYMENT_BLOCK%%/g,    paymentBlockInline(business))
    .replace(/%%EXTRAS_BLOCK%%/g,     ctx.blocks.extras ? extrasBlockInline(extraEntries) : '')
    .replace(/%%SIGNATURE_BLOCK%%/g,  signatureBlock(business.name))
    .replace(/%%SUBTOTAL%%/g,         fmt(itemRows.reduce((s, r) => s + getTaxable(r), 0)))
    .replace(/%%TOTAL%%/g,            fmt(itemRows.reduce((s, r) => s + getTaxable(r) * (1 + (r.gstPct ?? 0) / 100), 0)));
}

// ── Main render ───────────────────────────────────────────────────────────────

export function renderInvoice(designId: string, input: RenderInput, aiHtml?: string | null): string {
  if (designId.startsWith('ai_') && aiHtml) {
    return renderAiTemplate(aiHtml, input);
  }
  return renderLegacyInput(designId, input);
}
