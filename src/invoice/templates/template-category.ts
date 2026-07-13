/**
 * TemplateCategory: the business purpose of a document, driving which
 * category layout (see invoice/renderer/layouts/) renders it. Distinct
 * from `DocumentCategory` in types/index.ts, which is a persisted,
 * UI-facing grouping used only for icon/color theming of user document
 * types — this one drives structural HTML layout selection.
 */
export type TemplateCategory =
  | 'invoice'      // GST Invoice, Proforma Invoice, plain Invoice
  | 'sales'        // Quotation / Estimate
  | 'procurement'  // Purchase Order
  | 'payment'      // Receipt
  | 'logistics'    // Delivery Challan, Dispatch Sheet, Stock Transfer
  | 'service'      // Job Card, Service Report, Work Order, Site Visit Report
  | 'internal';    // Expense Voucher

/**
 * TemplateTheme: cross-cutting visual variant, orthogonal to category.
 * Every category can in principle offer any of these themes.
 */
export type TemplateTheme =
  | 'modern' | 'corporate' | 'minimal' | 'elegant' | 'thermal' | 'professional';
