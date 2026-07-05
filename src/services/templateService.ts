import { getDb } from '../database/db';
import {
  Template, TemplateVersion, TemplateConfig, TemplateType, DocumentCategory,
  Invoice, ExtraFieldType,
  RendererType, TemplateStyle, TemplateIndustry,
  GeneratedTemplateMetadata, ValidationResult, StaticSignature,
} from '../types';
import { generateId, nowIso } from '../utils/id';
import { getSession } from './businessService';
import { validateTemplate } from './templateValidator';
import { SYSTEM_DOCUMENT_TYPES, detectTemplateType } from '../constants';

// ─── Row mappers ─────────────────────────────────────────────────────────────

function rowToTemplate(row: any): Template {
  return {
    id:               row.id,
    businessId:       row.business_id,
    name:             row.name,
    industryPreset:   row.industry_preset ?? undefined,
    templateType:     (row.template_type ?? 'transaction_document') as TemplateType,
    state:            row.state,
    currentVersionId: row.current_version_id ?? undefined,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
    // UI extension columns
    icon:             row.icon ?? 'document-text-outline',
    category:         row.category ?? 'custom',
  } as Template & { icon: string; category: DocumentCategory };
}

function rowToVersion(row: any): TemplateVersion {
  return {
    id:                   row.id,
    templateId:           row.template_id,
    versionNo:            row.version_no,
    config:               JSON.parse(row.config || '{}') as TemplateConfig,
    rendererType:         (row.renderer_type ?? 'form') as RendererType,
    payload:              row.payload ?? null,
    style:                row.style ?? undefined,
    validationJson:       row.validation_json ? JSON.parse(row.validation_json) as ValidationResult : undefined,
    staticSignatureJson:  row.static_signature_json ? JSON.parse(row.static_signature_json) as StaticSignature : undefined,
    publishedAt:          row.published_at,
    publishedBy:          row.published_by,
  };
}

// ─── Default config factory ───────────────────────────────────────────────────
// Produces a minimal published config so invoices can be created immediately
// without a template editor (Phase 2 will replace this with full editing).

function isGstTemplate(name: string): boolean {
  return name.toLowerCase().includes('gst');
}

function buildDefaultConfig(templateId: string, name: string, versionNo: number, templateType: TemplateType = 'transaction_document'): TemplateConfig {
  return {
    schemaVersion: '1.0',
    meta: {
      templateId,
      versionNo,
      name,
      industryPreset: null,
      documentType: 'invoice',
      templateType,
    },
    identity: {
      documentName: name,
      prefix:       'INV',
      suffix:       null,
      separator:    '-',
      padDigits:    4,
      startNumber:  1,
      autoNumber:   true,
      showDate:     true,
      dateFormat:   'DD/MM/YYYY',
    },
    layout: {
      paper:       'a4',
      orientation: 'portrait',
      margins:     { top: 20, right: 20, bottom: 20, left: 20 },
      fontSizeBase: 14,
    },
    branding: {
      showLogo:                  false,
      showBusinessName:          true,
      showAddress:               true,
      showPhone:                 true,
      showEmail:                 false,
      showGstin:                 true,
      showLicenseNumber:         false,
      showStampPlaceholder:      false,
      showSignaturePlaceholder:  false,
      footerText:                'Thank you for your business',
      watermarkDraft:            true,
    },
    customer: {
      walkInAllowed: true,
      walkInLabel:   'Walk-in',
      fields: [
        { key: 'name',  label: 'Customer Name', visible: true,  required: false, order: 0 },
        { key: 'phone', label: 'Phone',          visible: true,  required: false, order: 1 },
        { key: 'gstin', label: 'GST Number',     visible: false, required: false, order: 2 },
      ],
    },
    items: {
      inventoryLinked:     false,
      allowFreeTextItem:   true,
      allowInlineAdd:      false,
      showTotalsRow:       true,
      columns: [
        { key: 'item',     label: 'Item',      visible: true,  required: true,  order: 0, widthPct: 35, inputType: 'text',     inventoryLink: 'none', aggregation: 'none', voiceAliases: ['item','product','medicine'] },
        { key: 'hsn',      label: 'HSN/SAC',   visible: isGstTemplate(name), required: false, order: 1, widthPct: 10, inputType: 'text',     inventoryLink: 'none', aggregation: 'none', voiceAliases: [] },
        { key: 'qty',      label: 'Qty',        visible: true,  required: true,  order: 2, widthPct: 8,  inputType: 'number',   inventoryLink: 'none', aggregation: 'none', voiceAliases: ['quantity','qty','strips'] },
        { key: 'unit',     label: 'Unit',       visible: isGstTemplate(name), required: false, order: 3, widthPct: 8,  inputType: 'text',     inventoryLink: 'none', aggregation: 'none', voiceAliases: [] },
        { key: 'price',    label: 'Rate',       visible: true,  required: true,  order: 4, widthPct: 14, inputType: 'number',   inventoryLink: 'none', aggregation: 'none', voiceAliases: ['price','rate','cost'] },
        { key: 'tax_rate', label: 'GST %',      visible: isGstTemplate(name), required: false, order: 5, widthPct: 8,  inputType: 'number',   inventoryLink: 'none', aggregation: 'none', voiceAliases: [] },
        { key: 'amount',   label: 'Amount',     visible: true,  required: true,  order: 6, widthPct: 17, inputType: 'readonly', inventoryLink: 'none', aggregation: 'sum',  voiceAliases: [] },
      ],
    },
    calculations: {
      taxMode:            'exclusive',
      gstSplit:           isGstTemplate(name) ? 'cgst_sgst' : 'none',
      lineDiscount:       false,
      lineTax:            isGstTemplate(name),
      invoiceDiscount:    false,
      showSubtotal:       true,
      showTaxableAmount:  isGstTemplate(name),
      showCgst:           isGstTemplate(name),
      showSgst:           isGstTemplate(name),
      showIgst:           isGstTemplate(name),
      showCess:           false,
      cessRate:           null,
      showShipping:       false,
      shippingLabel:      'Shipping',
      showServiceCharge:  false,
      serviceChargeRate:  null,
      serviceChargeLabel: 'Service Charge',
      showRoundOff:       isGstTemplate(name),
      showSavings:        false,
    },
    payment: {
      showPaymentSection: true,
      showQrCode:         isGstTemplate(name),
      showBankDetails:    isGstTemplate(name),
      showPaymentTerms:   false,
      paymentTermsText:   null,
      methods: [
        { method: 'cash',          enabled: true,  label: 'Cash' },
        { method: 'upi',           enabled: true,  label: 'UPI' },
        { method: 'card',          enabled: true,  label: 'Card' },
        { method: 'bank_transfer', enabled: false, label: 'Bank Transfer' },
        { method: 'credit',        enabled: false, label: 'Credit' },
      ],
    },
    extraFields: [],
    voice: {
      enabled:              false,
      language:             'en-IN',
      itemTriggerWords:     ['add', 'enter', 'item'],
      quantityTriggerWords: ['quantity', 'qty', 'strips', 'pieces'],
      priceTriggerWords:    ['price', 'rate', 'cost'],
      confirmTriggerWords:  ['done', 'save', 'issue'],
      cancelTriggerWords:   ['cancel', 'clear'],
    },
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getAllTemplates(businessId: string): Promise<Array<Template & { icon: string; category: DocumentCategory }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT t.*
     FROM templates t
     WHERE t.business_id = ?
     ORDER BY t.name ASC`,
    [businessId]
  );
  return rows.map(rowToTemplate) as any;
}

export async function getPublishedTemplates(businessId: string): Promise<Array<Template & { icon: string; category: DocumentCategory }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT t.*
     FROM templates t
     WHERE t.business_id = ? AND t.state = 'published'
     ORDER BY t.name ASC`,
    [businessId]
  );
  return rows.map(rowToTemplate) as any;
}

export async function getPinnedTemplates(businessId: string): Promise<Array<Template & { icon: string; category: DocumentCategory }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT t.*
     FROM templates t
     JOIN pinned_templates p ON t.id = p.template_id
     WHERE t.business_id = ?
     ORDER BY p.pin_order ASC`,
    [businessId]
  );
  return rows.map(rowToTemplate) as any;
}

export async function getTemplateById(id: string): Promise<(Template & { icon: string; category: DocumentCategory }) | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM templates WHERE id = ?', [id]);
  return row ? rowToTemplate(row) as any : null;
}

export async function getLatestVersion(templateId: string): Promise<TemplateVersion | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM template_versions
     WHERE template_id = ?
     ORDER BY version_no DESC LIMIT 1`,
    [templateId]
  );
  return row ? rowToVersion(row) : null;
}

export async function getVersionById(id: string): Promise<TemplateVersion | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM template_versions WHERE id = ?', [id]);
  return row ? rowToVersion(row) : null;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createTemplate(
  businessId: string,
  name: string,
  category: DocumentCategory = 'custom',
  icon: string = 'document-text-outline',
  preset?: string,
  templateType: TemplateType = 'transaction_document'
): Promise<Template & { icon: string; category: DocumentCategory }> {
  const db    = await getDb();

  const dup = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM templates WHERE business_id = ? AND LOWER(name) = LOWER(?)',
    [businessId, name.trim()]
  );
  if (dup) throw new Error(`A document type named "${name.trim()}" already exists.`);

  const { workerId } = getSession();
  const now   = nowIso();
  const tplId = generateId();
  const verId = generateId();

  const config = buildDefaultConfig(tplId, name, 1, templateType);
  config.meta.industryPreset = preset ?? null;

  await db.runAsync(
    `INSERT INTO templates
       (id, business_id, name, icon, category, template_type, industry_preset,
        state, current_version_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
    [tplId, businessId, name, icon, category, templateType, preset ?? null, verId, now, now]
  );

  const configJson = JSON.stringify(config);
  await db.runAsync(
    `INSERT INTO template_versions
       (id, template_id, version_no, config, renderer_type, payload, published_at, published_by)
     VALUES (?, ?, 1, ?, 'form', ?, ?, ?)`,
    [verId, tplId, configJson, configJson, now, workerId]
  );

  const row = await db.getFirstAsync<any>('SELECT * FROM templates WHERE id = ?', [tplId]);
  return rowToTemplate(row!) as any;
}

export async function updateTemplate(
  id: string,
  updates: { name?: string; icon?: string; category?: DocumentCategory }
): Promise<void> {
  const db = await getDb();
  const pairs: string[] = [];
  const vals: any[] = [];

  if (updates.name     !== undefined) { pairs.push('name = ?');     vals.push(updates.name); }
  if (updates.icon     !== undefined) { pairs.push('icon = ?');     vals.push(updates.icon); }
  if (updates.category !== undefined) { pairs.push('category = ?'); vals.push(updates.category); }

  if (pairs.length === 0) return;
  pairs.push('updated_at = ?');
  vals.push(nowIso());
  vals.push(id);
  await db.runAsync(`UPDATE templates SET ${pairs.join(', ')} WHERE id = ?`, vals);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM templates WHERE id = ?', [id]);
}

// ─── Pinning ─────────────────────────────────────────────────────────────────

export async function pinTemplate(templateId: string): Promise<void> {
  const db = await getDb();
  const count = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM pinned_templates'
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO pinned_templates (template_id, pin_order) VALUES (?, ?)',
    [templateId, count?.count ?? 0]
  );
}

// Creates SYSTEM_DOCUMENT_TYPES and pins the first 4 on a brand-new install.
// Idempotent: no-op if any templates already exist for this business.
// ─── Deduplication ───────────────────────────────────────────────────────────

const REMOVED_TEMPLATE_NAMES = [
  'prescription', 'medical bill', 'patient receipt',
  'fee receipt', 'student receipt', 'fee record', 'attendance sheet',
  'tax invoice',   // replaced by 'Invoice' (no tax) and 'GST Invoice'
];

export async function removeDeprecatedTemplates(businessId: string): Promise<void> {
  const db   = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string }>(
    'SELECT id, name FROM templates WHERE business_id = ?',
    [businessId]
  );

  const toRemove = rows.filter(r =>
    REMOVED_TEMPLATE_NAMES.includes(r.name.toLowerCase().trim())
  );

  for (const { id } of toRemove) {
    await db.runAsync(
      `UPDATE invoices SET template_version_id = NULL
       WHERE template_version_id IN (
         SELECT id FROM template_versions WHERE template_id = ?
       )`,
      [id]
    );
    await db.runAsync('DELETE FROM template_versions WHERE template_id = ?', [id]);
    await db.runAsync('DELETE FROM pinned_templates WHERE template_id = ?', [id]);
    await db.runAsync('DELETE FROM templates WHERE id = ?', [id]);
  }
}

export async function deduplicateTemplates(businessId: string): Promise<void> {
  const db   = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; created_at: string }>(
    'SELECT id, name, created_at FROM templates WHERE business_id = ? ORDER BY created_at ASC',
    [businessId]
  );

  const seen     = new Set<string>();
  const toDelete: string[] = [];
  for (const r of rows) {
    const key = r.name.toLowerCase().trim();
    if (seen.has(key)) {
      toDelete.push(r.id);
    } else {
      seen.add(key);
    }
  }

  // Delete in FK-safe order: nullify invoice refs → versions → pinned → template
  for (const id of toDelete) {
    await db.runAsync(
      `UPDATE invoices SET template_version_id = NULL
       WHERE template_version_id IN (
         SELECT id FROM template_versions WHERE template_id = ?
       )`,
      [id]
    );
    await db.runAsync('DELETE FROM template_versions WHERE template_id = ?', [id]);
    await db.runAsync('DELETE FROM pinned_templates WHERE template_id = ?', [id]);
    await db.runAsync('DELETE FROM templates WHERE id = ?', [id]);
  }
}

export async function fixTemplateTypes(businessId: string): Promise<void> {
  const db   = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; category: string }>(
    'SELECT id, name, category FROM templates WHERE business_id = ?',
    [businessId]
  );
  for (const row of rows) {
    const correct = detectTemplateType(row.name, row.category as any);
    await db.runAsync(
      'UPDATE templates SET template_type = ? WHERE id = ?',
      [correct, row.id]
    );
    const ver = await db.getFirstAsync<{ id: string; config: string }>(
      'SELECT id, config FROM template_versions WHERE template_id = ? ORDER BY version_no DESC LIMIT 1',
      [row.id]
    );
    if (ver) {
      try {
        const cfg = JSON.parse(ver.config);
        if (cfg?.meta && cfg.meta.templateType !== correct) {
          cfg.meta.templateType = correct;
          await db.runAsync('UPDATE template_versions SET config = ? WHERE id = ?', [JSON.stringify(cfg), ver.id]);
        }
      } catch { /* malformed config — skip */ }
    }
  }
}

let _seeding = false;

export async function seedSystemTemplatesIfNeeded(businessId: string): Promise<void> {
  if (_seeding) return;
  _seeding = true;
  try {
    const db  = await getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM templates WHERE business_id = ?',
      [businessId]
    );
    if ((row?.count ?? 0) > 0) return;

    const created: Array<Template & { icon: string; category: DocumentCategory }> = [];
    for (const dt of SYSTEM_DOCUMENT_TYPES) {
      try {
        const tpl = await createTemplate(
          businessId, dt.name, dt.category, dt.icon, undefined, detectTemplateType(dt.name, dt.category)
        );
        created.push(tpl);
      } catch { /* skip if name already exists from a race */ }
    }

    for (const tpl of created.slice(0, 4)) {
      await pinTemplate(tpl.id);
    }
  } finally {
    _seeding = false;
  }
}

export async function unpinTemplate(templateId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM pinned_templates WHERE template_id = ?', [templateId]);
}

export async function isTemplatePinned(templateId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM pinned_templates WHERE template_id = ?',
    [templateId]
  );
  return (row?.count ?? 0) > 0;
}

// ─── Stats helpers (used by DocumentDashboardScreen) ─────────────────────────

export async function getInvoiceCountByTemplate(templateId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM invoices
     WHERE template_version_id IN (
       SELECT id FROM template_versions WHERE template_id = ?
     ) AND state != 'draft'`,
    [templateId]
  );
  return row?.count ?? 0;
}

export async function updateTemplateExtraFields(templateId: string, fieldNames: string[]): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string; config: string }>(
    `SELECT tv.id, tv.config
     FROM template_versions tv
     JOIN templates t ON t.current_version_id = tv.id
     WHERE t.id = ?`,
    [templateId]
  );
  if (!row) return;

  const config: TemplateConfig = JSON.parse(row.config);
  config.extraFields = fieldNames.map((label, i) => ({
    id:           generateId(),
    section:      'header' as const,
    type:         'text' as ExtraFieldType,
    label,
    key:          label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    visible:      true,
    required:     false,
    order:        i,
    placeholder:  null,
    voiceAliases: [],
  }));

  await db.runAsync(
    'UPDATE template_versions SET config = ? WHERE id = ?',
    [JSON.stringify(config), row.id]
  );
}

// ─── AI Template Versions ────────────────────────────────────────────────────

/**
 * Creates a new template_version row with renderer_type='html' and updates
 * the parent template's current_version_id.
 * config is always '{}' for HTML versions (NOT NULL constraint satisfaction).
 */
export async function saveAiTemplateVersion(
  templateId:   string,
  displayName:  string,
  html:         string,
  metadata?:    GeneratedTemplateMetadata,
  validation?:  ValidationResult,
  signature?:   StaticSignature,
): Promise<string> {
  const db               = await getDb();
  const { workerId }     = getSession();
  const now              = nowIso();
  const verId            = generateId();

  const lastVer = await db.getFirstAsync<{ version_no: number | null }>(
    'SELECT MAX(version_no) as version_no FROM template_versions WHERE template_id = ?',
    [templateId]
  );
  const versionNo = (lastVer?.version_no ?? 0) + 1;

  const sigWithName: StaticSignature | undefined = signature
    ? { ...signature, displayName }
    : undefined;

  await db.runAsync(
    `INSERT INTO template_versions
       (id, template_id, version_no, config, renderer_type, payload,
        style, validation_json, static_signature_json, published_at, published_by)
     VALUES (?, ?, ?, '{}', 'html', ?, ?, ?, ?, ?, ?)`,
    [
      verId, templateId, versionNo, html,
      metadata?.style ?? null,
      validation   ? JSON.stringify(validation)   : null,
      sigWithName  ? JSON.stringify(sigWithName)  : null,
      now, workerId,
    ]
  );

  // Update parent template metadata from AI response
  const metaUpdates: string[] = ['current_version_id = ?', 'updated_at = ?'];
  const metaVals: any[]       = [verId, now];
  if (metadata?.industry) { metaUpdates.push('industry = ?'); metaVals.push(metadata.industry); }
  if (metadata?.language) { metaUpdates.push('language = ?'); metaVals.push(metadata.language); }
  metaVals.push(templateId);

  await db.runAsync(
    `UPDATE templates SET ${metaUpdates.join(', ')} WHERE id = ?`,
    metaVals
  );

  return verId;
}

/**
 * Returns the raw AI HTML for a version. Returns null if not an html renderer version.
 */
export async function getAiTemplateHtmlById(versionId: string): Promise<string | null> {
  const db  = await getDb();
  const row = await db.getFirstAsync<{ payload: string | null }>(
    `SELECT payload FROM template_versions WHERE id = ? AND renderer_type = 'html'`,
    [versionId]
  );
  return row?.payload ?? null;
}

/**
 * Lists all HTML template versions for a given template, newest first.
 * displayName comes from static_signature_json.displayName.
 */
export async function listAiVersionsForTemplate(
  templateId: string
): Promise<Array<{ id: string; name: string; style?: string }>> {
  const db   = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    style: string | null;
    static_signature_json: string | null;
  }>(
    `SELECT id, style, static_signature_json
     FROM template_versions
     WHERE template_id = ? AND renderer_type = 'html'
     ORDER BY version_no DESC`,
    [templateId]
  );

  return rows.map(r => {
    let name = 'AI Template';
    if (r.static_signature_json) {
      try {
        const sig = JSON.parse(r.static_signature_json) as StaticSignature;
        if (sig.displayName) name = sig.displayName;
      } catch { /* ignore */ }
    }
    return { id: r.id, name, style: r.style ?? undefined };
  });
}

/**
 * Runs validation on a template version if not already cached, stores result,
 * and returns it. Blocks until validation completes.
 */
export async function ensureValidated(
  versionId:    string,
  documentType: string,
): Promise<ValidationResult> {
  const db  = await getDb();
  const row = await db.getFirstAsync<{
    validation_json: string | null;
    renderer_type:   string;
    payload:         string | null;
  }>(
    'SELECT validation_json, renderer_type, payload FROM template_versions WHERE id = ?',
    [versionId]
  );

  if (!row) throw new Error(`Template version not found: ${versionId}`);

  if (row.validation_json) {
    return JSON.parse(row.validation_json) as ValidationResult;
  }

  const rendererType = (row.renderer_type ?? 'form') as RendererType;
  const result       = validateTemplate(row.payload ?? '', rendererType, documentType);

  await db.runAsync(
    'UPDATE template_versions SET validation_json = ? WHERE id = ?',
    [JSON.stringify(result), versionId]
  );

  return result;
}

export async function getLastInvoiceByTemplate(templateId: string): Promise<Invoice | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM invoices
     WHERE template_version_id IN (
       SELECT id FROM template_versions WHERE template_id = ?
     ) AND state != 'draft'
     ORDER BY issued_at DESC LIMIT 1`,
    [templateId]
  );
  if (!row) return null;
  return rowToInvoice(row);
}

function rowToInvoice(row: any): Invoice {
  return {
    id:                 row.id,
    businessId:         row.business_id,
    templateVersionId:  row.template_version_id ?? undefined,
    customerId:         row.customer_id ?? undefined,
    workerId:           row.worker_id,
    deviceId:           row.device_id,
    number:             row.number ?? undefined,
    numberIsTemp:       row.number_is_temp === 1,
    numberBlockId:      row.number_block_id ?? undefined,
    invoiceType:        row.invoice_type,
    state:              row.state,
    subtotalPaise:      row.subtotal_paise,
    discountPaise:      row.discount_paise,
    cgstPaise:          row.cgst_paise,
    sgstPaise:          row.sgst_paise,
    igstPaise:          row.igst_paise,
    cessPaise:          row.cess_paise,
    shippingPaise:      row.shipping_paise,
    roundOffPaise:      row.round_off_paise,
    totalPaise:         row.total_paise,
    paymentState:       row.payment_state,
    paymentMethod:      row.payment_method ?? undefined,
    returnOfId:         row.return_of_id ?? undefined,
    notes:              row.notes ?? undefined,
    issuedAt:           row.issued_at ?? undefined,
    cancelledAt:        row.cancelled_at ?? undefined,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}
