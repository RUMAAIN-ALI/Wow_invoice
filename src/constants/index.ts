import type { DocumentCategory, SuggestedField, TemplateType } from '../types';

export const COLORS = {
  primary:       '#F97316',
  primaryDark:   '#EA580C',
  background:    '#F8FAFC',
  surface:       '#FFFFFF',
  border:        '#F1F5F9',
  borderStrong:  '#E2E8F0',
  text:          '#0F172A',
  textSecondary: '#64748B',
  textMuted:     '#9CA3AF',
  success:       '#22C55E',
  warning:       '#D97706',
  danger:        '#DC2626',
  disabled:      '#D1D5DB',
};

/** Android Material Design 3 sizing tokens — use these everywhere. */
export const MD3 = {
  // Typography (sp)
  fs: {
    appBar:   20,   // Appbar title
    hero:     22,   // Hero / display titles
    title:    17,   // Section headers
    body:     15,   // Primary body text
    bodyMd:   14,   // Secondary body
    label:    12,   // Captions, labels, badges
    micro:    11,   // Uppercase field labels
  },
  // Layout (dp)
  appBarH:     56,
  buttonH:     52,
  inputH:      48,
  rowH:        60,   // List / action rows
  fabSize:     56,
  iconBox:     40,   // Standard icon container
  iconBoxSm:   32,   // Small icon container
  chevronCirc: 28,   // Chevron circle button
  // Spacing (dp)
  hPad:        16,   // Horizontal screen padding
  cardPad:     16,   // Card internal padding
  gap:         12,   // Gap between cards
  gapSm:        8,   // Small gap
  // Radius (dp)
  radius: {
    xs:    8,
    sm:   12,
    md:   16,   // Cards, inputs, buttons
    lg:   20,   // Bottom sheets
    full: 999,
  },
};

// Per-document-type semantic colors. Lookup by lowercased document name.
// Fallback: CATEGORY_COLORS[category] → CATEGORY_COLORS['custom']
export const DOC_TYPE_COLORS: Record<string, { bg: string; icon: string }> = {
  // Revenue — orange
  'invoice':           { bg: '#FFF7ED', icon: '#EA580C' },
  'gst invoice':       { bg: '#FFF7ED', icon: '#EA580C' },
  'tax invoice':       { bg: '#FFF7ED', icon: '#EA580C' },
  'receipt':           { bg: '#FFF7ED', icon: '#EA580C' },
  'expense voucher':   { bg: '#FFF7ED', icon: '#EA580C' },
  // Proposals / pending — blue
  'quotation':         { bg: '#EFF6FF', icon: '#2563EB' },
  'estimate':          { bg: '#EFF6FF', icon: '#2563EB' },
  'proforma invoice':  { bg: '#EFF6FF', icon: '#2563EB' },
  // Movement / fulfillment — green
  'delivery challan':  { bg: '#F0FDF4', icon: '#16A34A' },
  'delivery note':     { bg: '#F0FDF4', icon: '#16A34A' },
  'dispatch sheet':    { bg: '#F0FDF4', icon: '#16A34A' },
  'stock transfer':    { bg: '#F0FDF4', icon: '#16A34A' },
  // Procurement / commitment — purple
  'purchase order':    { bg: '#F5F3FF', icon: '#7C3AED' },
  'work order':        { bg: '#F5F3FF', icon: '#7C3AED' },
  // Service / informational — slate
  'service report':    { bg: '#F1F5F9', icon: '#64748B' },
  'job card':          { bg: '#F1F5F9', icon: '#64748B' },
  'site visit report': { bg: '#F1F5F9', icon: '#64748B' },
};

export const CATEGORY_COLORS: Record<DocumentCategory, { bg: string; icon: string }> = {
  billing:   { bg: '#FFF7ED', icon: '#EA580C' },   // orange — commerce, revenue
  logistics: { bg: '#FEF9C3', icon: '#B45309' },   // amber — movement, transport
  education: { bg: '#F5F3FF', icon: '#7C3AED' },   // purple — knowledge
  services:  { bg: '#F0FDF4', icon: '#16A34A' },   // green — completion, done
  custom:    { bg: '#F1F5F9', icon: '#475569' },   // slate — neutral
};

export const SYSTEM_DOCUMENT_TYPES = [
  { name: 'Invoice',          category: 'billing'   as DocumentCategory, icon: 'document-text-outline' },
  { name: 'GST Invoice',      category: 'billing'   as DocumentCategory, icon: 'receipt-outline' },
  { name: 'Proforma Invoice', category: 'billing'   as DocumentCategory, icon: 'clipboard-outline' },
  { name: 'Purchase Order',   category: 'billing'   as DocumentCategory, icon: 'cube-outline' },
  { name: 'Delivery Challan', category: 'logistics' as DocumentCategory, icon: 'car-outline' },
  { name: 'Receipt',          category: 'billing'   as DocumentCategory, icon: 'wallet-outline' },
];

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  billing:   'Billing',
  logistics: 'Logistics',
  education: 'Education',
  services:  'Services',
  custom:    'Custom',
};

export const ALL_DOCUMENT_TYPES = [
  // Billing — primary use case for traders, kirana, garments, distributors
  { name: 'Invoice',          category: 'billing'   as DocumentCategory, icon: 'document-text-outline' },
  { name: 'GST Invoice',      category: 'billing'   as DocumentCategory, icon: 'receipt-outline' },
  { name: 'Proforma Invoice', category: 'billing'   as DocumentCategory, icon: 'clipboard-outline' },
  { name: 'Quotation',        category: 'billing'   as DocumentCategory, icon: 'create-outline' },
  { name: 'Purchase Order',   category: 'billing'   as DocumentCategory, icon: 'cube-outline' },
  { name: 'Receipt',          category: 'billing'   as DocumentCategory, icon: 'wallet-outline' },
  { name: 'Expense Voucher',  category: 'billing'   as DocumentCategory, icon: 'cash-outline' },
  // Logistics — traders, distributors, manufacturers
  { name: 'Delivery Challan', category: 'logistics' as DocumentCategory, icon: 'car-outline' },
  { name: 'Dispatch Sheet',   category: 'logistics' as DocumentCategory, icon: 'clipboard-outline' },
  { name: 'Stock Transfer',   category: 'logistics' as DocumentCategory, icon: 'swap-horizontal-outline' },
  // Services — contractors, repair shops, service businesses
  { name: 'Service Report',   category: 'services'  as DocumentCategory, icon: 'build-outline' },
  { name: 'Job Card',         category: 'services'  as DocumentCategory, icon: 'construct-outline' },
  { name: 'Work Order',       category: 'services'  as DocumentCategory, icon: 'hammer-outline' },
  { name: 'Site Visit Report',category: 'services'  as DocumentCategory, icon: 'location-outline' },
];

/**
 * Which base template ids are available for a given document type, keyed by
 * lowercase document type name. When a type has an entry here, only these
 * templates are offered (replacing the generic Classic/Modern/Minimal/etc. set).
 * Types with no entry fall back to every generic template — this is how new
 * document-type-specific templates get rolled out incrementally.
 */
export const TEMPLATES_BY_DOCUMENT_TYPE: Record<string, string[]> = {
  'gst invoice':          ['gst_standard', 'gst_compact', 'gst_formal'],
  'quotation':            ['corporate_quote', 'sales_proposal', 'minimal_quote'],
  'proforma invoice':     ['standard_proforma', 'professional_proforma'],
  'purchase order':       ['corporate_po', 'procurement_po'],
  'receipt':              ['thermal', 'compact_receipt'],
  'expense voucher':      ['voucher', 'simple_expense'],
  'delivery challan':     ['dispatch', 'warehouse'],
  'dispatch sheet':       ['standard_dispatch'],
  'stock transfer':       ['transfer_sheet'],
  'job card':             ['workshop', 'service_center'],
  'service report':       ['inspection', 'professional_report'],
  'work order':           ['standard_work_order'],
  'site visit report':    ['site_inspection'],
};

export const FIELD_TYPE_LABELS: Record<string, string> = {
  text:      'Text',
  number:    'Number',
  date:      'Date',
  currency:  'Currency (₹)',
  dropdown:  'Dropdown',
  signature: 'Signature',
  table:     'Table',
  photo:     'Photo',
  checkbox:  'Checkbox',
};

export const FIELD_TYPE_ICONS: Record<string, string> = {
  text:      'create-outline',
  number:    'calculator-outline',
  date:      'calendar-outline',
  currency:  'cash-outline',
  dropdown:  'chevron-down-circle-outline',
  signature: 'pencil-outline',
  table:     'grid-outline',
  photo:     'camera-outline',
  checkbox:  'checkbox-outline',
};

// Icon options for CreateDocumentTypeScreen (Ionicons names)
export const ICON_OPTIONS: string[] = [
  'receipt-outline',
  'document-text-outline',
  'wallet-outline',
  'cube-outline',
  'create-outline',
  'medkit-outline',
  'flask-outline',
  'person-circle-outline',
  'fitness-outline',
  'car-outline',
  'clipboard-outline',
  'map-outline',
  'school-outline',
  'book-outline',
  'construct-outline',
  'build-outline',
  'briefcase-outline',
  'star-outline',
  'business-outline',
  'bag-outline',
];

export const SUGGESTIONS: Record<string, SuggestedField[]> = {
  invoice: [
    { name: 'Customer Name', type: 'text',     required: true  },
    { name: 'Item Table',    type: 'table',    required: true  },
    { name: 'Due Date',      type: 'date',     required: false },
    { name: 'Notes',         type: 'text',     required: false },
  ],
  'gst invoice': [
    { name: 'Customer Name',  type: 'text',  required: true  },
    { name: 'Customer GSTIN', type: 'text',  required: false },
    { name: 'Customer State', type: 'text',  required: false },
    { name: 'Place of Supply',type: 'text',  required: false },
    { name: 'Item Table',     type: 'table', required: true  },
    { name: 'Due Date',       type: 'date',  required: false },
    { name: 'Notes',          type: 'text',  required: false },
  ],
  'proforma invoice': [
    { name: 'Customer Name', type: 'text',     required: true  },
    { name: 'Item Table',    type: 'table',    required: true  },
    { name: 'Valid Until',   type: 'date',     required: false },
    { name: 'Terms',         type: 'text',     required: false },
    { name: 'Notes',         type: 'text',     required: false },
  ],
  'tax invoice': [
    { name: 'Customer Name', type: 'text',  required: true  },
    { name: 'Item Table',    type: 'table', required: true  },
    { name: 'Due Date',      type: 'date',  required: false },
    { name: 'Notes',         type: 'text',  required: false },
  ],
  receipt: [
    { name: 'Customer Name',  type: 'text',     required: true  },
    { name: 'Item Table',     type: 'table',    required: true  },
    { name: 'Payment Method', type: 'dropdown', required: false },
    { name: 'Notes',          type: 'text',     required: false },
  ],
  quotation: [
    { name: 'Customer Name', type: 'text',  required: true  },
    { name: 'Item Table',    type: 'table', required: true  },
    { name: 'Valid Until',   type: 'date',  required: false },
    { name: 'Terms',         type: 'text',  required: false },
  ],
  'purchase order': [
    { name: 'Supplier Name', type: 'text',  required: true  },
    { name: 'Item Table',    type: 'table', required: true  },
    { name: 'Order Date',    type: 'date',  required: true  },
    { name: 'Delivery Date', type: 'date',  required: false },
    { name: 'Notes',         type: 'text',  required: false },
  ],
  'delivery challan': [
    { name: 'Customer Name', type: 'text',  required: true  },
    { name: 'Item Table',    type: 'table', required: true  },
    { name: 'Delivery Date', type: 'date',  required: true  },
    { name: 'Driver Name',   type: 'text',  required: false },
    { name: 'Vehicle No',    type: 'text',  required: false },
  ],
  'expense voucher': [
    { name: 'Paid To',   type: 'text',     required: true  },
    { name: 'Date',      type: 'date',     required: true  },
    { name: 'Category',  type: 'text',     required: false },
    { name: 'Amount',    type: 'currency', required: true  },
    { name: 'Notes',     type: 'text',     required: false },
  ],
  'job card': [
    { name: 'Customer Name', type: 'text',     required: true  },
    { name: 'Job Date',      type: 'date',     required: true  },
    { name: 'Description',   type: 'text',     required: true  },
    { name: 'Parts Table',   type: 'table',    required: false },
    { name: 'Total',         type: 'currency', required: true  },
  ],
  'service report': [
    { name: 'Customer Name',   type: 'text', required: true  },
    { name: 'Service Date',    type: 'date', required: true  },
    { name: 'Work Done',       type: 'text', required: true  },
    { name: 'Engineer Name',   type: 'text', required: false },
    { name: 'Next Visit Date', type: 'date', required: false },
  ],
  'vehicle inspection': [
    { name: 'Vehicle Number', type: 'text', required: true  },
    { name: 'Driver Name',    type: 'text', required: true  },
    { name: 'Date',           type: 'date', required: true  },
  ],
};

export function getSuggestions(name: string): SuggestedField[] {
  const key = name.toLowerCase().trim();
  return SUGGESTIONS[key] ?? [];
}

// ─── Template type detection ──────────────────────────────────────────────────

const TRANSACTION_KEYWORDS = [
  'invoice', 'quotation', 'quote', 'receipt', 'purchase order', 'bill',
  'proforma', 'debit note', 'credit note', 'delivery note', 'challan',
  'tax invoice', 'estimate', 'order form', 'sales order',
];

export function detectTemplateType(name: string, category: DocumentCategory): TemplateType {
  if (category === 'billing') return 'transaction_document';
  const lower = name.toLowerCase();
  if (TRANSACTION_KEYWORDS.some(k => lower.includes(k))) return 'transaction_document';
  return 'record_form';
}

export function templateTypeLabel(type: TemplateType): string {
  return type === 'transaction_document' ? 'Invoice / Bill' : 'Service Form';
}

// ─── Local field presets (fuzzy-matched before AI fallback) ──────────────────

const LOCAL_THRESHOLD = 0.8;

// Keys are lowercase document names; values are extra field names (no item table).
const FIELD_PRESETS: Record<string, string[]> = {
  // ── Vehicles ──────────────────────────────────────────────────────────────
  'vehicle inspection':  ['Vehicle Number', 'Customer Name', 'Odometer Reading', 'Inspector Name', 'Inspection Date', 'Brake Status', 'Tyre Status', 'Remarks'],
  'vehicle check':       ['Vehicle Number', 'Customer Name', 'Odometer Reading', 'Brake Check', 'Tyre Check', 'Remarks'],
  'vehicle service':     ['Vehicle Number', 'Customer Name', 'Odometer Reading', 'Service Type', 'Technician', 'Next Service Date', 'Remarks'],
  'bike service':        ['Bike Number', 'Customer Name', 'Odometer Reading', 'Service Type', 'Technician', 'Next Service Date', 'Remarks'],
  'bike':                ['Bike Number', 'Customer Name', 'Odometer Reading', 'Service Type', 'Technician', 'Remarks'],
  'car service':         ['Car Number', 'Customer Name', 'Odometer Reading', 'Service Type', 'Technician', 'Next Service Date', 'Remarks'],
  'car':                 ['Car Number', 'Customer Name', 'Odometer Reading', 'Service Type', 'Technician', 'Remarks'],
  'scooter service':     ['Scooter Number', 'Customer Name', 'Odometer Reading', 'Service Type', 'Technician', 'Remarks'],
  // ── Repairs ───────────────────────────────────────────────────────────────
  'job card':            ['Customer Name', 'Vehicle No', 'Complaint', 'Technician', 'Start Date', 'Completion Date', 'Notes'],
  'repair card':         ['Customer Name', 'Item', 'Fault Description', 'Technician', 'Start Date', 'Completion Date', 'Notes'],
  'repair':              ['Customer Name', 'Item', 'Issue', 'Technician', 'Estimated Cost', 'Status', 'Notes'],
  'mobile repair':       ['Customer Name', 'Phone Model', 'IMEI', 'Issue', 'Technician', 'Status', 'Notes'],
  'phone repair':        ['Customer Name', 'Phone Model', 'IMEI', 'Issue', 'Technician', 'Status', 'Notes'],
  'laptop repair':       ['Customer Name', 'Laptop Model', 'Serial No', 'Issue', 'Technician', 'Status', 'Notes'],
  'computer repair':     ['Customer Name', 'Device Model', 'Serial No', 'Issue', 'Technician', 'Status', 'Notes'],
  'ac repair':           ['Customer Name', 'AC Model', 'Location', 'Issue', 'Technician', 'Visit Date', 'Remarks'],
  'appliance repair':    ['Customer Name', 'Appliance', 'Model', 'Issue', 'Technician', 'Visit Date', 'Remarks'],
  // ── Services ──────────────────────────────────────────────────────────────
  'service report':      ['Customer Name', 'Service Name', 'Technician', 'Start Date', 'Completion Date', 'Status', 'Notes'],
  'work order':          ['Customer Name', 'Description', 'Assigned To', 'Due Date', 'Priority', 'Status'],
  'complaint form':      ['Customer Name', 'Date', 'Description', 'Assigned To', 'Status', 'Resolution'],
  'site visit':          ['Customer Name', 'Site Address', 'Visit Date', 'Engineer', 'Work Done', 'Next Visit', 'Remarks'],
  'site report':         ['Site Name', 'Date', 'Supervisor', 'Work Done', 'Issues', 'Remarks'],
  'daily report':        ['Date', 'Reported By', 'Summary', 'Issues', 'Actions Taken'],
  'inspection report':   ['Inspector Name', 'Date', 'Location', 'Findings', 'Remarks'],
  // ── Logistics ─────────────────────────────────────────────────────────────
  'delivery challan':    ['Customer Name', 'Delivery Date', 'Driver Name', 'Vehicle No', 'From', 'To', 'Remarks'],
  'dispatch sheet':      ['Customer Name', 'Date', 'From', 'To', 'Driver Name', 'Vehicle No', 'Remarks'],
  // ── Business ──────────────────────────────────────────────────────────────
  'expense report':      ['Date', 'Category', 'Description', 'Amount', 'Approved By'],
  'expense voucher':     ['Customer Name', 'Date', 'Category', 'Amount', 'Notes'],
  'stock transfer':      ['From Location', 'To Location', 'Date', 'Items', 'Transferred By'],
  // ── Transaction extra fields (items table added separately via templateType)
  'invoice':             ['Customer Name', 'Due Date', 'Notes'],
  'gst invoice':         ['Customer Name', 'Customer GSTIN', 'Customer State', 'Place of Supply', 'Due Date', 'Payment Method', 'Notes'],
  'tax invoice':         ['Customer Name', 'Due Date', 'Notes'],
  'proforma invoice':    ['Customer Name', 'Valid Until', 'Terms', 'Notes'],
  'quotation':           ['Customer Name', 'Valid Until', 'Terms'],
  'receipt':             ['Customer Name', 'Payment Method', 'Notes'],
  'purchase order':      ['Customer Name', 'Customer GSTIN', 'Customer State', 'Order Date', 'Delivery Date', 'Notes'],
  'delivery note':       ['Customer Name', 'Delivery Date', 'Driver Name', 'Notes'],
};

function wordOverlapScore(query: string, presetKey: string): number {
  const presetWords = presetKey.split(/\s+/);
  const queryLower  = query.toLowerCase();
  const matches = presetWords.filter(w => queryLower.includes(w)).length;
  return matches / presetWords.length;
}

export function getLocalFieldSuggestions(name: string): { fields: string[]; score: number } {
  const lower = name.toLowerCase().trim();
  let bestScore  = 0;
  let bestKeyLen = 0;
  let bestFields: string[] = [];

  for (const [key, fields] of Object.entries(FIELD_PRESETS)) {
    const score = wordOverlapScore(lower, key);
    // Prefer higher score; on tie, prefer the more specific (longer) key
    if (score > bestScore || (score === bestScore && score > 0 && key.length > bestKeyLen)) {
      bestScore  = score;
      bestKeyLen = key.length;
      bestFields = fields;
    }
  }

  return { fields: bestFields, score: bestScore };
}

export { LOCAL_THRESHOLD };
export * from './design';
