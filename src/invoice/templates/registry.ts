import { TemplateDefinition } from './template-definition';
import { TemplateCategory, TemplateTheme } from './template-category';

export const SYSTEM_TEMPLATES: Record<string, TemplateDefinition> = {
  classic: {
    id: 'classic',
    name: 'Classic Design',
    description: 'Traditional two-column layout with brand accent bar',
    category: 'invoice',
    theme: 'corporate',
    capabilities: {
      branding: { logo: true, qrCode: true, signature: true },
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
      layout: { margins: true, orientation: true, extraFields: true }
    }
  },
  modern: {
    id: 'modern',
    name: 'Modern Design',
    description: 'Contemporary full-width colored header band styling',
    category: 'invoice',
    theme: 'modern',
    capabilities: {
      branding: { logo: true, qrCode: true, signature: true },
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
      layout: { margins: true, orientation: true, extraFields: true }
    }
  },
  minimal: {
    id: 'minimal',
    name: 'Minimalist Design',
    description: 'Sophisticated black & white serif layout with clean ruled lines',
    category: 'invoice',
    theme: 'minimal',
    capabilities: {
      branding: { logo: false, qrCode: true, signature: true }, // Supports UPI text printing
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
      layout: { margins: false, orientation: false, extraFields: true }
    }
  },
  letterhead: {
    id: 'letterhead',
    name: 'Letterhead Design',
    description: 'Corporate letterhead styling with a large header and formal signature block',
    category: 'invoice',
    theme: 'professional',
    capabilities: {
      branding: { logo: true, qrCode: true, signature: true },
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
      layout: { margins: true, orientation: true, extraFields: true }
    }
  },
  thermal: {
    id: 'thermal',
    name: 'Thermal / Compact',
    description: 'Single-column receipt layout optimized for 58mm/80mm thermal printers',
    category: 'payment',
    theme: 'thermal',
    capabilities: {
      branding: { logo: false, qrCode: false, signature: false },
      taxation: { hsnColumn: false, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: false, paymentTerms: false, upiDetails: true },
      layout: { margins: false, orientation: false, extraFields: false }
    }
  },
  gst_standard: {
    id: 'gst_standard',
    name: 'GST Standard',
    description: 'Full compliance layout with a prominent GSTIN band and detailed tax breakup',
    category: 'invoice',
    theme: 'corporate',
    capabilities: {
      branding: { logo: true, qrCode: true, signature: true },
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
      layout: { margins: true, orientation: true, extraFields: true }
    }
  },
  gst_compact: {
    id: 'gst_compact',
    name: 'GST Compact',
    description: 'Condensed GST invoice layout that fits more line items per page',
    category: 'invoice',
    theme: 'minimal',
    capabilities: {
      branding: { logo: true, qrCode: true, signature: true },
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: false, upiDetails: true },
      layout: { margins: false, orientation: true, extraFields: false }
    }
  }
};

// ─── Shape-based capability defaults ─────────────────────────────────────────
// Every template below is rendered using one of a few shared layout "shapes"
// (formal, standard, compact, blank — see renderer.ts/header.ts). Capabilities
// here follow the shape's visual character rather than being hand-tuned per id.

const FORMAL_CAPS = {
  branding: { logo: true, qrCode: true, signature: true },
  taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
  payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
  layout: { margins: true, orientation: true, extraFields: true },
};

const STANDARD_CAPS = {
  branding: { logo: true, qrCode: true, signature: true },
  taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
  payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
  layout: { margins: true, orientation: true, extraFields: true },
};

const COMPACT_CAPS = {
  branding: { logo: false, qrCode: true, signature: true },
  taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
  payment: { bankDetails: true, paymentTerms: false, upiDetails: true },
  layout: { margins: false, orientation: true, extraFields: false },
};

const BLANK_CAPS = {
  branding: { logo: false, qrCode: false, signature: true },
  taxation: { hsnColumn: false, gstBreakup: false, taxSummary: true },
  payment: { bankDetails: false, paymentTerms: false, upiDetails: false },
  layout: { margins: true, orientation: false, extraFields: true },
};

function define(
  id: string,
  name: string,
  description: string,
  caps: typeof FORMAL_CAPS,
  category: TemplateCategory,
  theme: TemplateTheme,
): TemplateDefinition {
  return { id, name, description, capabilities: caps, category, theme };
}

// FORMAL shape — corporate/letterhead-style band header, strong signature block
Object.assign(SYSTEM_TEMPLATES, {
  gst_formal:            define('gst_formal', 'GST Formal', 'Letterhead-style GST invoice with a prominent GSTIN band', FORMAL_CAPS, 'invoice', 'professional'),
  corporate_quote:       define('corporate_quote', 'Corporate Quote', 'Formal quotation layout for B2B and agency clients', FORMAL_CAPS, 'sales', 'corporate'),
  sales_proposal:        define('sales_proposal', 'Sales Proposal', 'Persuasive, branded proposal-style quotation layout', FORMAL_CAPS, 'sales', 'elegant'),
  professional_proforma: define('professional_proforma', 'Professional Proforma', 'Formal proforma invoice with a corporate letterhead band', FORMAL_CAPS, 'invoice', 'professional'),
  corporate_po: define('corporate_po', 'Corporate PO', 'Formal purchase order layout for vendor-facing documents', FORMAL_CAPS, 'procurement', 'corporate'),
  professional_report: define('professional_report', 'Professional Report', 'Formal service report with a corporate letterhead band', FORMAL_CAPS, 'service', 'professional'),
});

// STANDARD shape — classic two-column header + accent bar
Object.assign(SYSTEM_TEMPLATES, {
  standard_proforma: define('standard_proforma', 'Standard Proforma', 'Straightforward proforma invoice, two-column header', STANDARD_CAPS, 'invoice', 'corporate'),
  procurement_po:    define('procurement_po', 'Procurement PO', 'Detailed purchase order for procurement workflows', STANDARD_CAPS, 'procurement', 'corporate'),
  voucher:           define('voucher', 'Voucher', 'Standard expense voucher layout', STANDARD_CAPS, 'internal', 'corporate'),
  dispatch:          define('dispatch', 'Dispatch', 'Standard delivery challan for outgoing goods', STANDARD_CAPS, 'logistics', 'corporate'),
  warehouse:         define('warehouse', 'Warehouse', 'Delivery challan variant for warehouse-to-warehouse transfers', STANDARD_CAPS, 'logistics', 'corporate'),
  standard_dispatch: define('standard_dispatch', 'Standard Dispatch', 'Dispatch sheet for multi-item shipment runs', STANDARD_CAPS, 'logistics', 'corporate'),
  transfer_sheet:    define('transfer_sheet', 'Transfer Sheet', 'Stock transfer layout between locations', STANDARD_CAPS, 'logistics', 'corporate'),
  workshop:          define('workshop', 'Workshop', 'Job card for repair/workshop tracking', STANDARD_CAPS, 'service', 'corporate'),
  service_center:    define('service_center', 'Service Center', 'Job card variant for service-center intake', STANDARD_CAPS, 'service', 'corporate'),
  inspection:        define('inspection', 'Inspection', 'Service report focused on inspection checklists', STANDARD_CAPS, 'service', 'corporate'),
  standard_work_order: define('standard_work_order', 'Standard Work Order', 'Standard work order layout', STANDARD_CAPS, 'service', 'corporate'),
  site_inspection:   define('site_inspection', 'Site Inspection', 'Site visit report with inspection notes', STANDARD_CAPS, 'service', 'corporate'),
});

// COMPACT shape — condensed single-block header, tighter spacing
Object.assign(SYSTEM_TEMPLATES, {
  minimal_quote:   define('minimal_quote', 'Minimal Quote', 'Condensed quotation layout, fits more items per page', COMPACT_CAPS, 'sales', 'minimal'),
  compact_receipt: define('compact_receipt', 'Compact Receipt', 'Condensed receipt layout for busy counters', COMPACT_CAPS, 'payment', 'minimal'),
  simple_expense:  define('simple_expense', 'Simple Expense', 'Condensed expense voucher for quick logging', COMPACT_CAPS, 'internal', 'minimal'),
});

// BLANK shape — bare-bones layout for user-defined document types
Object.assign(SYSTEM_TEMPLATES, {
  blank_template: define('blank_template', 'Blank Template', 'Minimal starting point for a custom document type', BLANK_CAPS, 'internal', 'minimal'),
});
