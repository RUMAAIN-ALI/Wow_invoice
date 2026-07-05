import { TemplateDefinition } from '../templates/template-definition';
import { ResolvedTheme } from '../themes/resolved-theme';
import { InvoiceData } from './invoice-data';
import { renderHeader } from './header';
import { renderItemsTable } from './items-table';
import { renderTotals } from './totals';
import { renderPaymentBlock, renderExtrasBlock, renderSignatureBlock } from './footer';

/**
 * renderInvoice: Pure function that compiles template HTML.
 * Takes the Template layout definition, Resolved Theme variables, and Invoice data.
 * Does zero side effects, zero DB lookups, and compiles deterministically.
 */
export function renderInvoice(
  template: TemplateDefinition,
  theme: ResolvedTheme,
  data: InvoiceData
): string {
  const brand = theme.accentColor;
  
  if (template.id === 'modern') {
    const fontStr = theme.fontFamily === 'Helvetica Neue'
      ? "'Helvetica Neue',Helvetica,Arial,sans-serif"
      : `'${theme.fontFamily}','Helvetica Neue',Helvetica,Arial,sans-serif`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-style:normal}
  body{font-family:${fontStr};font-size:${theme.fontSizeBasePx}px;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:794px;margin:0 auto;padding:40px 20px 36px}
  @media(min-width:600px){.page{padding:56px 52px 48px}}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:32px}
  .hdr-left{flex:1;min-width:0}
  .biz-name{font-size:24px;font-weight:700;color:#111;letter-spacing:-.3px;margin-bottom:8px}
  .biz-det{font-size:12px;color:#555;line-height:1.6;font-weight:400}
  .doc-r{text-align:right;flex-shrink:0}
  .docno{font-size:24px;font-weight:700;color:#111;letter-spacing:-.3px;margin-bottom:8px}
  .docdt{font-size:12px;color:#555;font-weight:500}
  .doc-type{font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${brand};margin-top:6px}
  .bto{margin-bottom:32px}
  .lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px}
  .bname{font-size:15px;font-weight:600;color:#111}
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:32px}
  .foot{margin-top:48px;padding-top:24px;display:flex;justify-content:space-between;align-items:flex-end}
  .thanks{font-size:13px;color:#555;font-weight:500}
  .disc{text-align:center;margin-top:24px;font-size:11px;color:#aaa}
</style>
</head>
<body><div class="page">
  ${renderHeader(template.id, theme, data)}
  ${data.items.length ? `<div class="tbl-wrap">${renderItemsTable(template.id, theme, data.items)}</div>` : ''}
  ${data.items.length ? renderTotals(theme, data.items, data.sellerState, data.customerState) : ''}
  ${renderExtrasBlock(data)}
  ${renderPaymentBlock(theme, data)}
  <div class="foot">
    <div class="thanks">${theme.footerText !== undefined && theme.footerText !== null ? theme.footerText : 'Thank you for your business.'}</div>
    ${renderSignatureBlock(theme, data.sellerName)}
  </div>
  <div class="disc">This is a computer-generated document.</div>
</div></body>
</html>`;
  }

  if (template.id === 'letterhead') {
    const fontStr = theme.fontFamily === 'Georgia'
      ? "Georgia,'Times New Roman',serif"
      : `'${theme.fontFamily}',Georgia,'Times New Roman',serif`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-style:normal}
  body{font-family:${fontStr};font-size:${theme.fontSizeBasePx}px;color:#1a1a1a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:794px;margin:0 auto;padding:0 0 48px}
  .letterhead-band{background:${brand};color:#fff;padding:36px 52px;text-align:center;border-bottom:6px solid #1a1a1a}
  .letterhead-band .biz-name{font-size:28px;font-weight:700;letter-spacing:0.5px}
  .letterhead-band .biz-det{font-size:12px;color:rgba(255,255,255,0.85);margin-top:8px;line-height:1.7}
  .hdr{display:flex;justify-content:space-between;align-items:center;padding:24px 52px 8px}
  .doc-type{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${brand}}
  .doc-r{text-align:right}
  .docno{font-size:15px;font-weight:700}
  .docdt{font-size:12px;color:#666;margin-top:2px}
  .bto{margin:12px 52px 20px}
  .lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}
  .bname{font-size:16px;font-weight:600}
  .body-pad{padding:0 52px}
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:24px}
  .foot{margin-top:40px;padding:24px 52px 0;border-top:2px solid #1a1a1a;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
  .thanks{font-size:13px;color:#555;font-weight:500}
  .disc{text-align:center;margin-top:20px;font-size:10px;color:#c0c0c0}
</style>
</head>
<body><div class="page">
  ${renderHeader(template.id, theme, data)}
  <div class="body-pad">
    ${data.items.length ? `<div class="tbl-wrap">${renderItemsTable(template.id, theme, data.items)}</div>` : ''}
    ${data.items.length ? renderTotals(theme, data.items, data.sellerState, data.customerState, false, template.id) : ''}
    ${renderExtrasBlock(data)}
    ${renderPaymentBlock(theme, data)}
  </div>
  <div class="foot">
    <div class="thanks">${theme.footerText !== undefined && theme.footerText !== null ? theme.footerText : 'Thank you for your business.'}</div>
    ${renderSignatureBlock(theme, data.sellerName, template.id)}
  </div>
  <div class="disc">This is a computer-generated document.</div>
</div></body>
</html>`;
  }

  if (template.id === 'thermal') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-style:normal}
  body{font-family:'Courier New',Consolas,monospace;font-size:${Math.max(theme.fontSizeBasePx, 13)}px;color:#111;background:#fff}
  .page{max-width:302px;margin:0 auto;padding:12px 10px}
  .thm-hdr{text-align:center}
  .thm-hdr .biz-name{font-size:16px;font-weight:700;margin-bottom:4px}
  .thm-hdr .biz-det{font-size:11px;color:#333;line-height:1.5}
  .thm-rule{text-align:center;font-size:11px;color:#555;margin:8px 0;letter-spacing:1px}
  .thm-meta{font-size:12px;line-height:1.7}
  .thm-items{margin:8px 0}
  .thm-item-row{margin-bottom:6px}
  .thm-item-name{font-size:12.5px;font-weight:600}
  .thm-item-line{display:flex;justify-content:space-between;font-size:12px;color:#333}
  .foot{margin-top:16px;text-align:center}
  .thanks{font-size:12px;color:#333;font-weight:600}
  .disc{text-align:center;margin-top:14px;font-size:9.5px;color:#999}
</style>
</head>
<body><div class="page">
  ${renderHeader(template.id, theme, data)}
  ${data.items.length ? renderItemsTable(template.id, theme, data.items) : ''}
  <div class="thm-rule">- - - - - - - - - - - - - - - - - - - -</div>
  ${data.items.length ? renderTotals(theme, data.items, data.sellerState, data.customerState, false, template.id) : ''}
  <div class="foot">
    <div class="thanks">${theme.footerText !== undefined && theme.footerText !== null ? theme.footerText : 'Thank you for your business!'}</div>
  </div>
  <div class="disc">This is a computer-generated document.</div>
</div></body>
</html>`;
  }

  if (template.id === 'minimal') {
    const fontStr = theme.fontFamily === 'Georgia'
      ? "Georgia,'Times New Roman',serif"
      : `'${theme.fontFamily}',Georgia,'Times New Roman',serif`;

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-style:normal}
  body{font-family:${fontStr};font-size:${theme.fontSizeBasePx}px;color:#111;background:#fff}
  .page{max-width:794px;margin:0 auto;padding:56px 60px;position:relative;overflow:hidden}
  .wm{position:absolute;top:42%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:64px;font-weight:900;text-transform:uppercase;letter-spacing:6px;white-space:nowrap;color:#111;opacity:0.04;pointer-events:none;user-select:none;z-index:0}
  .content{position:relative;z-index:1}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:2px solid #111}
  .biz-name{font-size:20px;font-weight:700}
  .biz-det{font-size:11px;color:#555;margin-top:6px;line-height:1.75;font-family:Arial,sans-serif}
  .doc-r{text-align:right}
  .docno{font-size:13px;font-weight:700;font-family:'Courier New',monospace;letter-spacing:1px}
  .docdt{font-size:11px;color:#555;margin-top:4px;font-family:Arial,sans-serif}
  .bto{margin:22px 0}
  .lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:4px;font-family:Arial,sans-serif}
  .bname{font-size:15px;font-weight:600}
  .foot{margin-top:48px;border-top:1px solid #111;padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end}
  .thanks{font-size:13px;color:#555;font-weight:500}
  .disc{text-align:center;margin-top:20px;font-size:9.5px;color:#bbb;font-family:Arial,sans-serif}
</style>
</head>
<body><div class="page">
  <div class="wm">${data.documentTypeName}</div>
  <div class="content">
    ${renderHeader(template.id, theme, data)}
    ${data.items.length ? renderItemsTable(template.id, theme, data.items) : ''}
    ${data.items.length ? renderTotals(theme, data.items, data.sellerState, data.customerState, true) : ''}
    ${renderExtrasBlock(data)}
    ${renderPaymentBlock(theme, data)}
    <div class="foot">
      <div class="thanks">${theme.footerText !== undefined && theme.footerText !== null ? theme.footerText : 'Thank you for your business.'}</div>
      ${renderSignatureBlock(theme, data.sellerName)}
    </div>
    <div class="disc">This is a computer-generated document.</div>
  </div>
</div></body>
</html>`;
  }

  // Classic design (default layout)
  const fontStr = theme.fontFamily === 'Arial'
    ? "Arial,Helvetica,sans-serif"
    : `'${theme.fontFamily}',Arial,Helvetica,sans-serif`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-style:normal}
  body{font-family:${fontStr};font-size:${theme.fontSizeBasePx}px;color:#1a1a1a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:794px;margin:0 auto;padding:32px 20px}
  @media(min-width:600px){.page{padding:48px 52px}}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  .hdr-left{flex:1;min-width:0}
  .biz-name{font-size:20px;font-weight:700;color:${brand};word-break:break-word}
  .biz-det{font-size:11px;color:#555;margin-top:6px;line-height:1.8;font-weight:400}
  .doc-r{text-align:right;flex-shrink:0}
  .badge{display:inline-block;background:${brand};color:#fff;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:4px 12px;border-radius:4px}
  .docno{font-size:17px;font-weight:700;margin-top:8px}
  .docdt{font-size:11px;color:#666;margin-top:3px;font-weight:500}
  .bar{height:3px;background:${brand};border-radius:2px;margin:18px 0 22px}
  .bto{margin-bottom:20px}
  .lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}
  .bname{font-size:15px;font-weight:600}
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .foot{margin-top:36px;padding-top:18px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
  .thanks{font-size:13px;color:#555;font-weight:500}
  .disc{text-align:center;margin-top:18px;font-size:10px;color:#c0c0c0}
</style>
</head>
<body><div class="page">
  ${renderHeader(template.id, theme, data)}
  ${data.items.length ? `<div class="tbl-wrap">${renderItemsTable(template.id, theme, data.items)}</div>` : ''}
  ${data.items.length ? renderTotals(theme, data.items, data.sellerState, data.customerState) : ''}
  ${renderExtrasBlock(data)}
  ${renderPaymentBlock(theme, data)}
  <div class="foot">
    <div class="thanks">${theme.footerText !== undefined && theme.footerText !== null ? theme.footerText : 'Thank you for your business!'}</div>
    ${renderSignatureBlock(theme, data.sellerName)}
  </div>
  <div class="disc">This is a computer-generated document.</div>
</div></body>
</html>`;
}
