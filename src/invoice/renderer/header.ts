import { ResolvedTheme } from '../themes/resolved-theme';
import { InvoiceData } from './invoice-data';
import { esc, fmtDate } from './utils';

/**
 * renderHeader: Generates the HTML string representing the top header banner, 
 * business details, document metadata, and customer details based on layout style.
 */
export function renderHeader(
  templateId: string,
  theme: ResolvedTheme,
  data: InvoiceData
): string {
  const contactParts: string[] = [];
  if (theme.showPhone && data.sellerPhone) {
    contactParts.push('Tel: ' + esc(data.sellerPhone));
  }
  if (theme.showEmail && data.sellerEmail) {
    contactParts.push(esc(data.sellerEmail));
  }
  const contactLine = contactParts.join(' &nbsp;|&nbsp; ');

  const billToSection = data.customerName
    ? `<div class="bto"><div class="lbl">BILL TO</div><div class="bname">${esc(data.customerName)}</div></div>`
    : '';

  if (templateId === 'modern') {
    return `
<div class="hdr">
  <div class="hdr-left">
    <div class="biz-name">${theme.showBusinessName ? esc(data.sellerName) : ''}</div>
    <div class="biz-det">
      ${theme.showAddress && data.sellerAddress ? esc(data.sellerAddress) + '<br>' : ''}
      ${theme.showGstin && data.sellerGstin ? 'GSTIN: ' + esc(data.sellerGstin) + '<br>' : ''}
      ${contactLine}
    </div>
  </div>
  <div class="doc-r">
    <div class="docno">${esc(data.recordNumber)}</div>
    <div class="docdt">${fmtDate(data.recordCreatedAt, theme.dateFormat)}</div>
    <div class="doc-type">${esc(data.documentTypeName)}</div>
  </div>
</div>
${billToSection}
`;
  }

  if (templateId === 'letterhead') {
    return `
<div class="letterhead-band">
  <div class="biz-name">${theme.showBusinessName ? esc(data.sellerName) : ''}</div>
  <div class="biz-det">
    ${theme.showAddress && data.sellerAddress ? esc(data.sellerAddress) + '<br>' : ''}
    ${theme.showGstin && data.sellerGstin ? 'GSTIN: ' + esc(data.sellerGstin) + (contactLine ? ' &nbsp;|&nbsp; ' : '') : ''}
    ${contactLine}
  </div>
</div>
<div class="hdr">
  <div class="doc-type">${esc(data.documentTypeName)}</div>
  <div class="doc-r">
    <div class="docno">${esc(data.recordNumber)}</div>
    <div class="docdt">${fmtDate(data.recordCreatedAt, theme.dateFormat)}</div>
  </div>
</div>
${billToSection}
`;
  }

  if (templateId === 'thermal') {
    return `
<div class="thm-hdr">
  ${theme.showBusinessName ? `<div class="biz-name">${esc(data.sellerName)}</div>` : ''}
  <div class="biz-det">
    ${theme.showAddress && data.sellerAddress ? esc(data.sellerAddress) + '<br>' : ''}
    ${theme.showGstin && data.sellerGstin ? 'GSTIN: ' + esc(data.sellerGstin) + '<br>' : ''}
    ${contactLine}
  </div>
</div>
<div class="thm-rule">- - - - - - - - - - - - - - - - - - - -</div>
<div class="thm-meta">
  <div>${esc(data.documentTypeName)}: ${esc(data.recordNumber)}</div>
  <div>${fmtDate(data.recordCreatedAt, theme.dateFormat)}</div>
  ${data.customerName ? `<div>Customer: ${esc(data.customerName)}</div>` : ''}
</div>
<div class="thm-rule">- - - - - - - - - - - - - - - - - - - -</div>
`;
  }

  if (templateId === 'minimal') {
    const minBillTo = data.customerName ? billToSection : '<div style="height:22px"></div>';
    return `
<div class="hdr">
  <div>
    <div class="biz-name">${theme.showBusinessName ? esc(data.sellerName) : ''}</div>
    <div class="biz-det">
      ${theme.showAddress && data.sellerAddress ? esc(data.sellerAddress) + '<br>' : ''}
      ${theme.showGstin && data.sellerGstin ? 'GSTIN: ' + esc(data.sellerGstin) : ''}
      ${theme.showPhone && data.sellerPhone ? '<br>Tel: ' + esc(data.sellerPhone) : ''}
    </div>
  </div>
  <div class="doc-r">
    <div class="docno">${esc(data.recordNumber)}</div>
    <div class="docdt">${fmtDate(data.recordCreatedAt, theme.dateFormat)}</div>
  </div>
</div>
${minBillTo}
`;
  }

  // Fallback to 'classic' layout
  return `
<div class="hdr">
  <div class="hdr-left">
    <div class="biz-name">${theme.showBusinessName ? esc(data.sellerName) : ''}</div>
    <div class="biz-det">
      ${theme.showAddress && data.sellerAddress ? esc(data.sellerAddress) + '<br>' : ''}
      ${theme.showGstin && data.sellerGstin ? 'GSTIN: ' + esc(data.sellerGstin) + '<br>' : ''}
      ${contactLine}
    </div>
  </div>
  <div class="doc-r">
    <div class="badge">${esc(data.documentTypeName)}</div>
    <div class="docno">${esc(data.recordNumber)}</div>
    <div class="docdt">${fmtDate(data.recordCreatedAt, theme.dateFormat)}</div>
  </div>
</div>
<div class="bar"></div>
${billToSection}
`;
}
