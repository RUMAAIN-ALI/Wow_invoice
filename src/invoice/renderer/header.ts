import { ResolvedTheme } from '../themes/resolved-theme';
import { InvoiceData } from './invoice-data';
import { esc, fmtDate } from './utils';
import { FORMAL_IDS, COMPACT_IDS, BLANK_IDS } from './shapes';

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

  const logoBlock = theme.showLogo && data.sellerLogoUri
    ? `<div style="text-align:${theme.logoPosition || 'left'};margin-bottom:10px"><img src="${esc(data.sellerLogoUri)}" style="height:${theme.logoHeightPx}px;max-width:220px;object-fit:contain"></div>`
    : '';

  if (templateId === 'modern') {
    return `
${logoBlock}
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

  if (templateId === 'gst_standard') {
    return `
${logoBlock}
<div class="hdr">
  <div class="hdr-left">
    <div class="biz-name">${theme.showBusinessName ? esc(data.sellerName) : ''}</div>
    <div class="biz-det">
      ${theme.showAddress && data.sellerAddress ? esc(data.sellerAddress) + '<br>' : ''}
      ${contactLine}
    </div>
  </div>
  <div class="doc-r">
    <div class="badge">${esc(data.documentTypeName)}</div>
    <div class="docno">${esc(data.recordNumber)}</div>
    <div class="docdt">${fmtDate(data.recordCreatedAt, theme.dateFormat)}</div>
  </div>
</div>
${theme.showGstin && data.sellerGstin ? `
<div class="gstin-band">
  <span class="gstin-label">GSTIN</span>
  <span class="gstin-value">${esc(data.sellerGstin)}</span>
  ${data.customerState ? `<span class="gstin-state">Place of Supply: ${esc(data.customerState)}</span>` : ''}
</div>` : ''}
${billToSection}
`;
  }

  if (COMPACT_IDS.includes(templateId)) {
    return `
${logoBlock}
<div class="gc-hdr">
  <div class="gc-biz">
    <span class="gc-biz-name">${theme.showBusinessName ? esc(data.sellerName) : ''}</span>
    ${theme.showGstin && data.sellerGstin ? `<span class="gc-gstin">GSTIN: ${esc(data.sellerGstin)}</span>` : ''}
  </div>
  <div class="gc-doc">
    <span>${esc(data.documentTypeName)} ${esc(data.recordNumber)}</span>
    <span>${fmtDate(data.recordCreatedAt, theme.dateFormat)}</span>
  </div>
  ${data.customerName ? `<div class="gc-bill">Bill To: ${esc(data.customerName)}${data.customerState ? ' &nbsp;|&nbsp; ' + esc(data.customerState) : ''}</div>` : ''}
</div>
`;
  }

  if (FORMAL_IDS.includes(templateId)) {
    return `
<div class="letterhead-band">
  ${theme.showLogo && data.sellerLogoUri ? `<div style="text-align:${theme.logoPosition || 'left'};margin-bottom:10px"><img src="${esc(data.sellerLogoUri)}" style="height:${theme.logoHeightPx}px;max-width:200px;object-fit:contain;filter:brightness(0) invert(1)"></div>` : ''}
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
${templateId === 'gst_formal' && theme.showGstin && data.sellerGstin && data.customerState ? `
<div class="gstin-band">
  <span class="gstin-label">GSTIN</span>
  <span class="gstin-value">${esc(data.sellerGstin)}</span>
  <span class="gstin-state">Place of Supply: ${esc(data.customerState)}</span>
</div>` : ''}
${billToSection}
`;
  }

  if (templateId === 'thermal') {
    return `
${logoBlock}
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

  if (BLANK_IDS.includes(templateId)) {
    const minBillTo = data.customerName ? billToSection : '<div style="height:22px"></div>';
    return `
${logoBlock}
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
${logoBlock}
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
