import { ResolvedTheme } from '../themes/resolved-theme';
import { InvoiceData } from './invoice-data';
import { esc } from './utils';

/**
 * renderPaymentBlock: Displays UPI and Bank Details side by side if enabled and present.
 */
export function renderPaymentBlock(theme: ResolvedTheme, data: InvoiceData): string {
  if (!theme.showPaymentSection) return '';

  const hasUpi = theme.showQrCode && !!data.sellerUpiId;
  const hasBank = theme.showBankDetails && !!(data.sellerBankName || data.sellerAccountNumber);
  if (!hasUpi && !hasBank) return '';

  const upiSection = hasUpi ? `
    <div style="flex:1;min-width:160px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:6px">Pay via UPI</div>
      <div style="font-size:13px;font-weight:600;color:#1a1a1a">${esc(data.sellerUpiId!)}</div>
    </div>` : '';

  const bankSection = hasBank ? `
    <div style="flex:1;min-width:160px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:6px">Bank Transfer</div>
      ${data.sellerBankName    ? `<div style="font-size:12px;color:#333">${esc(data.sellerBankName)}</div>` : ''}
      ${data.sellerAccountNumber ? `<div style="font-size:12px;color:#333">A/C: ${esc(data.sellerAccountNumber)}</div>` : ''}
      ${data.sellerIfsc        ? `<div style="font-size:12px;color:#333">IFSC: ${esc(data.sellerIfsc)}</div>` : ''}
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

/**
 * renderExtrasBlock: Displays a two-column grid representing custom text fields.
 */
export function renderExtrasBlock(data: InvoiceData): string {
  const entries = data.extraFields;
  if (!entries || entries.length === 0) return '';
  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 40px;margin-top:22px;padding-top:18px;border-top:1px solid #eee">
  ${entries.map(e => `
  <div>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#aaa;margin-bottom:3px">${esc(e.label)}</div>
    <div style="font-size:13px;color:#1a1a1a">${esc(String(e.value))}</div>
  </div>`).join('')}
</div>`;
}

/**
 * renderSignatureBlock: Generates the authorising signature line at the bottom.
 */
export function renderSignatureBlock(theme: ResolvedTheme, bizName: string, templateId?: string): string {
  if (!theme.showSignature) return '';
  if (templateId === 'letterhead') {
    return `
<div style="text-align:center;border:1px solid #ddd;border-radius:8px;padding:16px 24px;min-width:220px">
  <div style="height:56px;border-bottom:2px solid ${theme.accentColor};width:200px;margin:0 auto 8px"></div>
  <div style="font-size:14px;font-weight:700">${esc(bizName)}</div>
  <div style="font-size:11px;color:#999;margin-top:3px;text-transform:uppercase;letter-spacing:0.5px">Authorised Signatory</div>
</div>`;
  }
  return `
<div style="text-align:center">
  <div style="height:44px;border-bottom:1px solid #333;width:160px;margin:0 auto 6px"></div>
  <div style="font-size:12px;font-weight:600">${esc(bizName)}</div>
  <div style="font-size:10px;color:#999;margin-top:2px">Authorised Signatory</div>
</div>`;
}
