// ─── Primitive Union Types ───────────────────────────────────────────────────

export type BusinessType =
  | 'pharmacy' | 'grocery' | 'garment' | 'restaurant'
  | 'hardware' | 'service' | 'wholesale' | 'other';

export type PrintPaperWidth = 'thermal_58' | 'thermal_80' | 'a4';
export type PrintFontSize   = 'small' | 'medium' | 'large';

export type WorkerRole = 'owner' | 'manager' | 'cashier' | 'viewer';

export type DevicePlatform = 'ios' | 'android' | 'web';

export type InvoiceDocumentType =
  | 'invoice' | 'tax_invoice' | 'bill' | 'receipt'
  | 'quotation' | 'purchase_order' | 'delivery_note';

export type InvoiceType   = 'sale' | 'return' | 'purchase';
export type InvoiceState  = 'draft' | 'issued' | 'cancelled' | 'returned';
export type TemplateState          = 'draft' | 'published' | 'archived';
export type TemplateLifecycleStatus = 'draft' | 'validated' | 'published' | 'archived';
export type RendererType    = 'form' | 'html';
export type TemplateStyle   = 'modern' | 'minimal' | 'professional' | 'premium' | 'classic';
export type TemplateIndustry =
  | 'retail' | 'restaurant' | 'garment' | 'pharma' | 'service' | 'wholesale' | 'other';
export type PageSize = 'a4' | 'thermal_58' | 'thermal_80';
export type PaymentState  = 'unpaid' | 'partial' | 'paid';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit';
export type PaymentRecordState = 'received' | 'refunded';
export type ExpenseState  = 'unpaid' | 'paid' | 'voided';
export type ExpenseCategory = 'rent' | 'salary' | 'utilities' | 'supplies' | 'other';
export type ProductUnit   = 'pcs' | 'kg' | 'g' | 'ml' | 'l' | 'strip' | 'box' | 'dozen' | 'meter';
export type PaperSize     = 'a4' | 'thermal_58' | 'thermal_80' | 'custom';
export type TaxMode       = 'exclusive' | 'inclusive';
export type GstSplit      = 'cgst_sgst' | 'igst' | 'none';
export type InventoryLink = 'none' | 'item' | 'batch' | 'expiry' | 'mrp';
export type ColumnInputType = 'text' | 'number' | 'date' | 'select' | 'readonly';
export type ExtraFieldType  = 'text' | 'date' | 'number' | 'phone' | 'notes' | 'signature';
export type ReconciliationStatus = 'open' | 'resolved' | 'ignored';

export type ConflictType =
  | 'stock_negative' | 'duplicate_number' | 'sync_gap'
  | 'inventory_mismatch' | 'tax_mismatch' | 'concurrent_edit';

export type ColumnKey =
  | 'item' | 'qty' | 'unit' | 'price' | 'amount'
  | 'sku' | 'hsn' | 'batch_no' | 'expiry_date' | 'mrp'
  | 'discount_pct' | 'discount_amt' | 'tax_rate' | 'tax_amt'
  | 'free_qty' | 'notes';

export type CustomerFieldKey =
  | 'name' | 'phone' | 'email' | 'gstin' | 'address' | 'city' | 'state';

// ─── Business & Identity ─────────────────────────────────────────────────────

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  gstin?: string;
  address?: string;
  city?: string;
  stateName?: string;
  phone?: string;
  email?: string;
  brandColor: string;
  logoPath?: string;
  licenseNumber?: string;
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  invoicePrefix: string;
  invoiceStartNumber: number;
  customBusinessType?: string;
  footerMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrintProfile {
  id: string;
  businessId: string;
  name: string;
  templateId: string;
  paperWidth: PrintPaperWidth;
  fontSize: PrintFontSize;
  showLogo: boolean;
  showGstin: boolean;
  showUpi: boolean;
  showSignature: boolean;
  isDefault: boolean;
  themeOverridesJson?: string;
  preferencesJson?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  businessId: string;
  name: string;
  role: WorkerRole;
  pinHash?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  businessId: string;
  fingerprint: string;
  platform: DevicePlatform;
  model?: string;
  registeredAt: string;
  lastSeenAt?: string;
}

// ─── Customers & Suppliers ───────────────────────────────────────────────────

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  stateName?: string;
  outstandingCredit: number; // paise
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku?: string;
  hsn?: string;
  unit: ProductUnit;
  category?: string;
  taxRate: number;       // percent × 100  (1800 = 18%)
  taxInclusive: boolean;
  trackInventory: boolean;
  trackBatches: boolean;
  qtyAvailable: number;  // integer × 1000 for 3 decimal places; used when trackBatches=false
  reorderLevel?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  businessId: string;
  productId: string;
  batchNo: string;
  expiryDate?: string;   // ISO 8601 date
  mrpPaise?: number;
  costPricePaise?: number;
  qtyAvailable: number;  // integer × 1000
  createdAt: string;
  updatedAt: string;
}

// ─── Template Config (Document 3) ────────────────────────────────────────────

export type TemplateType = 'transaction_document' | 'record_form';

export interface TemplateMeta {
  templateId: string;
  versionNo: number;
  name: string;
  industryPreset: string | null;
  documentType: InvoiceDocumentType;
  templateType: TemplateType;
}

export interface InvoiceIdentity {
  documentName: string;
  prefix: string;
  suffix: string | null;
  separator: string;
  padDigits: number;
  startNumber: number;
  autoNumber: boolean;
  showDate: boolean;
  dateFormat: string;
}

export interface LayoutMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutConfig {
  paper: PaperSize;
  orientation: 'portrait' | 'landscape';
  margins: LayoutMargins;
  fontSizeBase: number;
}

export interface BrandingConfig {
  showLogo: boolean;
  showBusinessName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showGstin: boolean;
  showLicenseNumber: boolean;
  showStampPlaceholder: boolean;
  showSignaturePlaceholder: boolean;
  footerText: string | null;
  watermarkDraft: boolean;
}

export interface CustomerFieldConfig {
  key: CustomerFieldKey;
  label: string;
  visible: boolean;
  required: boolean;
  order: number;
}

export interface CustomerConfig {
  walkInAllowed: boolean;
  walkInLabel: string;
  fields: CustomerFieldConfig[];
}

export interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  visible: boolean;
  required: boolean;
  order: number;
  widthPct: number;
  inputType: ColumnInputType;
  inventoryLink: InventoryLink;
  aggregation: 'sum' | 'none';
  voiceAliases: string[];
}

export interface ItemTableConfig {
  inventoryLinked: boolean;
  allowFreeTextItem: boolean;
  allowInlineAdd: boolean;
  showTotalsRow: boolean;
  columns: ColumnDefinition[];
}

export interface CalculationConfig {
  taxMode: TaxMode;
  gstSplit: GstSplit;
  lineDiscount: boolean;
  lineTax: boolean;
  invoiceDiscount: boolean;
  showSubtotal: boolean;
  showTaxableAmount: boolean;
  showCgst: boolean;
  showSgst: boolean;
  showIgst: boolean;
  showCess: boolean;
  cessRate: number | null;    // percent × 100
  showShipping: boolean;
  shippingLabel: string;
  showServiceCharge: boolean;
  serviceChargeRate: number | null;
  serviceChargeLabel: string;
  showRoundOff: boolean;
  showSavings: boolean;
}

export interface PaymentMethodConfig {
  method: PaymentMethod;
  enabled: boolean;
  label: string;
}

export interface PaymentConfig {
  showPaymentSection: boolean;
  showQrCode: boolean;
  showBankDetails: boolean;
  showPaymentTerms: boolean;
  paymentTermsText: string | null;
  methods: PaymentMethodConfig[];
}

export interface FieldDefinition {
  id: string;
  section: 'header' | 'footer' | 'notes';
  type: ExtraFieldType;
  label: string;
  key: string;
  visible: boolean;
  required: boolean;
  order: number;
  placeholder: string | null;
  voiceAliases: string[];
}

export interface VoiceConfig {
  enabled: boolean;
  language: string;
  itemTriggerWords: string[];
  quantityTriggerWords: string[];
  priceTriggerWords: string[];
  confirmTriggerWords: string[];
  cancelTriggerWords: string[];
}

export interface TemplateConfig {
  schemaVersion: string;
  meta: TemplateMeta;
  identity: InvoiceIdentity;
  layout: LayoutConfig;
  branding: BrandingConfig;
  customer: CustomerConfig;
  items: ItemTableConfig;
  calculations: CalculationConfig;
  payment: PaymentConfig;
  extraFields: FieldDefinition[];
  voice: VoiceConfig;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  businessId: string;
  name: string;
  industryPreset?: string;
  industry?: TemplateIndustry;
  language: string;
  templateType: TemplateType;
  state: TemplateState;
  currentVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNo: number;
  config: TemplateConfig;       // legacy; always '{}' for html renderer
  rendererType: RendererType;   // source of truth for which renderer to use
  payload: string | null;       // HTML string for 'html'; JSON string for 'form'
  style?: TemplateStyle;
  validationJson?: ValidationResult;
  staticSignatureJson?: StaticSignature;
  publishedAt: string;
  publishedBy: string;
}

// ─── AI Template Generation ──────────────────────────────────────────────────

export interface GeneratedTemplateMetadata {
  rendererType: 'html';
  templateType: string;
  industry?: string;
  style?: string;
  language?: string;
}

export interface TemplateGenerationInput {
  templateType: InvoiceDocumentType;
  industry?: TemplateIndustry;
  style?: TemplateStyle;
  language: string;
  pageSize: PageSize;
  theme: { useThemeColor: boolean };
  requiredPlaceholders: string[];
  businessContext?: string;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface SanitizationResult {
  html: string;
  htmlSizeBytes: number;         // structural size excluding data URIs
  removedScripts: number;
  removedEventHandlers: number;
  removedExternalResources: number;
  removedDangerousTags: number;
  safe: boolean;                 // true if input required no changes
}

export interface ValidationResult {
  passed: boolean;
  validHtml: boolean;
  placeholdersMissing: string[];
  placeholdersUnknown: string[];
  requiredSectionsPresent: boolean;
  unsupportedTags: string[];
  htmlSizeBytes: number;
  sanitization: SanitizationResult;
  validatedAt: string;
}

export interface StaticSignature {
  rendererType: RendererType;
  usesThemeColor: boolean;
  placeholderCount: number;
  imageCount: number;
  tableCount: number;
  cssRuleCount: number;
  displayName?: string;          // generation prompt truncated to 60 chars
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  businessId: string;
  templateVersionId?: string;
  customerId?: string;
  workerId: string;
  deviceId: string;
  number?: string;
  numberIsTemp: boolean;
  numberBlockId?: string;
  invoiceType: InvoiceType;
  state: InvoiceState;
  subtotalPaise: number;
  discountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  shippingPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  paymentState: PaymentState;
  paymentMethod?: PaymentMethod;
  returnOfId?: string;
  notes?: string;
  issuedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  lineNo: number;
  productId?: string;
  batchId?: string;
  itemName: string;
  sku?: string;
  hsn?: string;
  batchNo?: string;
  expiryDate?: string;
  unit?: string;
  qty: number;          // integer × 1000
  freeQty: number;      // integer × 1000
  mrpPaise?: number;
  pricePaise: number;
  discountPct: number;  // percent × 100
  discountPaise: number;
  taxRate: number;      // percent × 100
  taxPaise: number;
  amountPaise: number;
}

export interface InvoiceSnapshot {
  invoiceId: string;
  templateJson: string;   // frozen TemplateConfig serialised to JSON
  dataJson: string;       // frozen Invoice + InvoiceLine[] serialised to JSON
  renderedHtml?: string;  // pre-rendered for fast PDF/print
  createdAt: string;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amountPaise: number;
  method: PaymentMethod;
  reference?: string;
  state: PaymentRecordState;
  createdAt: string;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  businessId: string;
  category: ExpenseCategory;
  amountPaise: number;
  vendor?: string;
  notes?: string;
  receiptPath?: string;
  state: ExpenseState;
  paymentMethod?: PaymentMethod;
  createdAt: string;
  updatedAt: string;
}

// ─── Ledger ──────────────────────────────────────────────────────────────────

export interface LedgerEvent {
  id: string;
  businessId: string;
  deviceId: string;
  workerId: string;
  deviceSeq: number;
  cloudSeq?: number;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  syncedAt?: string;
  checksum: string;
}

// ─── Number Blocks ───────────────────────────────────────────────────────────

export interface NumberBlock {
  id: string;
  businessId: string;
  entityType: string;
  prefix: string;
  blockStart: number;
  blockEnd: number;
  nextAvailable: number;
  exhausted: boolean;
  receivedAt: string;
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export interface ReconciliationTask {
  id: string;
  businessId: string;
  conflictType: ConflictType;
  status: ReconciliationStatus;
  affectedIds: string[];
  description: string;
  resolutionHint?: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export interface SyncUploadRequest {
  lastCloudSeq: number;
  events: LedgerEvent[];
}

export interface SyncCorrection {
  eventId: string;
  correction: {
    eventType: string;
    entityId: string;
    payload: Record<string, unknown>;
  };
}

export interface SyncUploadResponse {
  accepted: Array<{ eventId: string; cloudSeq: number }>;
  rejected: Array<{ eventId: string; reason: string; message: string }>;
  corrections: SyncCorrection[];
  reconciliationTasks: ReconciliationTask[];
  latestCloudSeq: number;
}

export interface SyncDownloadResponse {
  events: LedgerEvent[];
  latestCloudSeq: number;
  hasMore: boolean;
}

// ─── Screen Compatibility Layer ───────────────────────────────────────────────
// These types support the existing screen layer during Phase 1.
// Screens will be rewritten against the core types above in the next phase.

export type DocumentCategory =
  | 'billing' | 'logistics' | 'education' | 'services' | 'custom';

export type FieldType =
  | 'text' | 'number' | 'date' | 'currency' | 'dropdown'
  | 'signature' | 'table' | 'photo' | 'checkbox';

export interface Field {
  id: string;
  templateId: string;
  name: string;
  type: FieldType;
  required: boolean;
  order: number;
  options?: string;
}

export interface TableRow {
  [key: string]: string | number;
}

export interface SuggestedField {
  name: string;
  type: FieldType;
  required: boolean;
}

// Alias for screens that still reference DocumentType (maps to Template)
export type DocumentType = Template & { icon: string; category: DocumentCategory };

// Alias for screens that still reference DocRecord (maps to Invoice + data string)
export interface DocRecord {
  id: string;
  documentTypeId: string;
  number: string;
  data: string;
  createdAt: string;
  issuedAt?: string;
  customerName?: string;
}

// View over Business for settings screens
export type BusinessSettings = Pick<Business,
  | 'id' | 'name' | 'type' | 'brandColor'
  | 'address' | 'city' | 'stateName' | 'phone' | 'email' | 'gstin'
  | 'licenseNumber' | 'upiId' | 'bankName' | 'accountNumber' | 'ifsc'
  | 'invoicePrefix' | 'invoiceStartNumber' | 'customBusinessType' | 'footerMessage'
> & { logo?: string };
