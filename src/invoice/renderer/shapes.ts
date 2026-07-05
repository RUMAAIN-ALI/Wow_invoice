/**
 * Shape groups — many template ids share one visual layout shape across
 * header.ts, footer.ts, and renderer.ts. See invoice/templates/registry.ts
 * for the full per-id name/description/capabilities.
 */
export const FORMAL_IDS = [
  'letterhead', 'gst_formal', 'corporate_quote', 'sales_proposal',
  'professional_proforma', 'corporate_po', 'professional_report',
];
export const COMPACT_IDS = ['gst_compact', 'minimal_quote', 'compact_receipt', 'simple_expense'];
export const BLANK_IDS = ['minimal', 'blank_template'];
