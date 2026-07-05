import { getDb } from '../database/db';
import { Invoice, InvoiceLine } from '../types';
import { generateId, nowIso } from '../utils/id';
import { getSession } from './businessService';
import { consumeNumber } from './numberBlockService';
import { findMatchingCustomer, createCustomer } from './customerService';

export interface CustomerDraft {
  name?: string;
  phone?: string;
  gstin?: string;
  stateName?: string;
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function rowToInvoice(row: any): Invoice {
  return {
    id:                row.id,
    businessId:        row.business_id,
    templateVersionId: row.template_version_id ?? undefined,
    customerId:        row.customer_id ?? undefined,
    workerId:          row.worker_id,
    deviceId:          row.device_id,
    number:            row.number ?? undefined,
    numberIsTemp:      row.number_is_temp === 1,
    numberBlockId:     row.number_block_id ?? undefined,
    invoiceType:       row.invoice_type,
    state:             row.state,
    subtotalPaise:     row.subtotal_paise,
    discountPaise:     row.discount_paise,
    cgstPaise:         row.cgst_paise,
    sgstPaise:         row.sgst_paise,
    igstPaise:         row.igst_paise,
    cessPaise:         row.cess_paise,
    shippingPaise:     row.shipping_paise,
    roundOffPaise:     row.round_off_paise,
    totalPaise:        row.total_paise,
    paymentState:      row.payment_state,
    paymentMethod:     row.payment_method ?? undefined,
    returnOfId:        row.return_of_id ?? undefined,
    notes:             row.notes ?? undefined,
    issuedAt:          row.issued_at ?? undefined,
    cancelledAt:       row.cancelled_at ?? undefined,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  };
}

function rowToLine(row: any): InvoiceLine {
  return {
    id:            row.id,
    invoiceId:     row.invoice_id,
    lineNo:        row.line_no,
    productId:     row.product_id ?? undefined,
    batchId:       row.batch_id ?? undefined,
    itemName:      row.item_name,
    sku:           row.sku ?? undefined,
    hsn:           row.hsn ?? undefined,
    batchNo:       row.batch_no ?? undefined,
    expiryDate:    row.expiry_date ?? undefined,
    unit:          row.unit ?? undefined,
    qty:           row.qty,
    freeQty:       row.free_qty,
    mrpPaise:      row.mrp_paise ?? undefined,
    pricePaise:    row.price_paise,
    discountPct:   row.discount_pct,
    discountPaise: row.discount_paise,
    taxRate:       row.tax_rate,
    taxPaise:      row.tax_paise,
    amountPaise:   row.amount_paise,
  };
}

// ─── Create & issue ───────────────────────────────────────────────────────────
// Phase 1: creates draft then immediately issues (no lifecycle delay).
// Phase 3 will split this into createDraft → issue with proper state machine.

export async function createRecord(
  templateVersionId: string,
  _typeName: string,     // kept for screen compatibility
  data: Record<string, any>,
  customer?: { id?: string; draft?: CustomerDraft }
): Promise<Invoice & { data: string; documentTypeId: string }> {
  const db = await getDb();
  const { businessId, workerId, deviceId } = getSession();
  const now = nowIso();
  const id  = generateId();

  // Resolve which saved customer (if any) this invoice links to.
  let resolvedCustomerId: string | null = customer?.id ?? null;
  if (!resolvedCustomerId && customer?.draft) {
    const { name, phone, gstin, stateName } = customer.draft;
    if (name?.trim() || phone?.trim() || gstin?.trim()) {
      const match = await findMatchingCustomer(businessId, { name, phone, gstin });
      if (match) {
        resolvedCustomerId = match.id;
      } else if (name?.trim() && (phone?.trim() || gstin?.trim())) {
        const created = await createCustomer(businessId, { name: name.trim(), phone, gstin, stateName });
        resolvedCustomerId = created.id;
      }
    }
  }

  // Derive totals from table fields
  let totalPaise = 0;
  let subtotalPaise = 0;
  for (const val of Object.values(data)) {
    if (Array.isArray(val)) {
      for (const row of val) {
        if (row.qty && row.price) {
          const lineTotal = Math.round(Number(row.qty) * Number(row.price) * 100);
          subtotalPaise += lineTotal;
        }
      }
    }
    if (typeof val === 'string' || typeof val === 'number') {
      const n = Number(val);
      if (!isNaN(n) && String(val).toLowerCase().includes('total')) {
        totalPaise = Math.round(n * 100);
      }
    }
  }
  if (totalPaise === 0) totalPaise = subtotalPaise;

  // Assign invoice number
  const number = await consumeNumber(businessId, 'invoice');
  const issuedAt = now;

  await db.runAsync(
    `INSERT INTO invoices
       (id, business_id, template_version_id, customer_id, worker_id, device_id,
        number, number_is_temp, invoice_type, state,
        subtotal_paise, discount_paise, cgst_paise, sgst_paise,
        igst_paise, cess_paise, shipping_paise, round_off_paise,
        total_paise, payment_state, notes,
        issued_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?,
             ?, 0, 'sale', 'issued',
             ?, 0, 0, 0, 0, 0, 0, 0, ?, 'unpaid', ?,
             ?, ?, ?)`,
    [
      id, businessId, templateVersionId, resolvedCustomerId, workerId, deviceId,
      number,
      subtotalPaise, totalPaise,
      data.Notes ?? data.notes ?? null,
      issuedAt, now, now,
    ]
  );

  // Store line items
  const tableEntries = Object.entries(data).filter(([, v]) => Array.isArray(v));
  if (tableEntries.length > 0) {
    const [, rows] = tableEntries[0];
    for (let i = 0; i < (rows as any[]).length; i++) {
      const r = (rows as any[])[i];
      if (!r.name && !r.item) continue;
      const lineId    = generateId();
      const qty       = Math.round(Number(r.qty ?? 1) * 1000);
      const price     = Math.round(Number(r.price ?? 0) * 100);
      const amount    = Math.round((Number(r.qty ?? 1) * Number(r.price ?? 0)) * 100);
      await db.runAsync(
        `INSERT INTO invoice_lines
           (id, invoice_id, line_no, item_name, qty, free_qty,
            price_paise, discount_pct, discount_paise,
            tax_rate, tax_paise, amount_paise)
         VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, 0, 0, ?)`,
        [lineId, id, i, r.name ?? r.item, qty, price, amount]
      );
    }
  }

  // Snapshot the exact form data (customer details, notes, items) at the time of issue,
  // independent of the invoices/invoice_lines columns and of the customers master record.
  const versionRow = await db.getFirstAsync<{ config: string }>(
    'SELECT config FROM template_versions WHERE id = ?', [templateVersionId]
  );
  await db.runAsync(
    `INSERT INTO invoice_snapshots (invoice_id, template_json, data_json, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, versionRow?.config ?? '{}', JSON.stringify(data), now]
  );

  const row = await db.getFirstAsync<any>('SELECT * FROM invoices WHERE id = ?', [id]);
  const invoice = rowToInvoice(row!);

  // Return shape compatible with current PreviewRecordScreen
  return {
    ...invoice,
    data:           JSON.stringify(data),
    documentTypeId: templateVersionId,
  } as any;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getRecordById(
  id: string
): Promise<(Invoice & { number: string; data: string; documentTypeId: string }) | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM invoices WHERE id = ?', [id]);
  if (!row) return null;

  const snapshot = await db.getFirstAsync<{ data_json: string }>(
    'SELECT data_json FROM invoice_snapshots WHERE invoice_id = ?', [id]
  );

  let data: Record<string, any>;
  if (snapshot?.data_json) {
    data = JSON.parse(snapshot.data_json);
  } else {
    // Legacy fallback for invoices created before snapshots existed: item table only.
    const lines = await db.getAllAsync<any>(
      'SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY line_no', [id]
    );
    const tableRows = lines.map(l => ({
      name:  l.item_name,
      qty:   l.qty / 1000,
      price: l.price_paise / 100,
    }));
    data = { 'Item Table': tableRows };
  }

  const invoice = rowToInvoice(row);
  return {
    ...invoice,
    data:           JSON.stringify(data),
    documentTypeId: invoice.templateVersionId ?? '',
    number:         invoice.number ?? '',
    createdAt:      invoice.createdAt,
  } as any;
}

export interface RecordListCursor {
  issuedAt: string;
  id: string;
}

export interface RecordListPage {
  items: Array<Invoice & { data: string; number: string; customerName?: string }>;
  nextCursor: RecordListCursor | null;
}

export async function getRecordsByDocumentType(
  templateId: string,
  options: {
    search?: string;
    limit?: number;
    cursor?: RecordListCursor | null;
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<RecordListPage> {
  const db = await getDb();
  const { search, limit = 50, cursor = null, dateFrom, dateTo } = options;

  const params: any[] = [templateId];
  let where = `tv.template_id = ? AND i.state != 'draft'`;

  const term = search?.trim();
  if (term) {
    const like = `%${term}%`;
    where += ` AND (
      i.number LIKE ? OR i.notes LIKE ? OR i.state LIKE ? OR
      CAST(i.total_paise AS TEXT) LIKE ? OR
      c.name LIKE ? OR c.phone LIKE ? OR c.gstin LIKE ?
    )`;
    params.push(like, like, like, like, like, like, like);
  }

  if (dateFrom) { where += ` AND i.issued_at >= ?`; params.push(dateFrom); }
  if (dateTo)   { where += ` AND i.issued_at <= ?`; params.push(dateTo); }

  if (cursor) {
    where += ` AND (i.issued_at, i.id) < (?, ?)`;
    params.push(cursor.issuedAt, cursor.id);
  }

  params.push(limit);

  const rows = await db.getAllAsync<any>(
    `SELECT i.*, c.name AS customer_name FROM invoices i
     JOIN template_versions tv ON i.template_version_id = tv.id
     LEFT JOIN customers c ON i.customer_id = c.id
     WHERE ${where}
     ORDER BY i.issued_at DESC, i.id DESC
     LIMIT ?`,
    params
  );

  const items = rows.map(r => ({
    ...rowToInvoice(r),
    data: '{}',
    number: r.number ?? '',
    customerName: r.customer_name ?? undefined,
  })) as any;

  const last = rows[rows.length - 1];
  const nextCursor = rows.length === limit && last
    ? { issuedAt: last.issued_at, id: last.id }
    : null;

  return { items, nextCursor };
}

export async function getAvailableYears(templateId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ year: string }>(
    `SELECT DISTINCT strftime('%Y', i.issued_at) as year
     FROM invoices i JOIN template_versions tv ON i.template_version_id = tv.id
     WHERE tv.template_id = ? AND i.state != 'draft' AND i.issued_at IS NOT NULL
     ORDER BY year DESC`,
    [templateId]
  );
  return rows.map(r => r.year).filter(Boolean);
}

export async function getAvailableMonths(templateId: string, year: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ month: string }>(
    `SELECT DISTINCT strftime('%m', i.issued_at) as month
     FROM invoices i JOIN template_versions tv ON i.template_version_id = tv.id
     WHERE tv.template_id = ? AND i.state != 'draft' AND strftime('%Y', i.issued_at) = ?
     ORDER BY month DESC`,
    [templateId, year]
  );
  return rows.map(r => r.month).filter(Boolean);
}

export async function getRecordCountByType(templateId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM invoices i
     JOIN template_versions tv ON i.template_version_id = tv.id
     WHERE tv.template_id = ? AND i.state != 'draft'`,
    [templateId]
  );
  return row?.count ?? 0;
}

export async function getLastCreatedRecord(templateId: string): Promise<Invoice | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT i.* FROM invoices i
     JOIN template_versions tv ON i.template_version_id = tv.id
     WHERE tv.template_id = ? AND i.state != 'draft'
     ORDER BY i.issued_at DESC LIMIT 1`,
    [templateId]
  );
  return row ? rowToInvoice(row) : null;
}

export async function getRecentRecords(limit = 5): Promise<Array<
  Invoice & { typeName: string; typeIcon: string; typeCategory: string; data: string }
>> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT i.*, t.name as type_name, t.icon as type_icon, t.category as type_category
     FROM invoices i
     JOIN template_versions tv ON i.template_version_id = tv.id
     JOIN templates t ON tv.template_id = t.id
     WHERE i.state != 'draft'
     ORDER BY i.issued_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(r => ({
    ...rowToInvoice(r),
    data:         '{}',
    typeName:     r.type_name,
    typeIcon:     r.type_icon,
    typeCategory: r.type_category,
  })) as any;
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDb();
  try {
    await db.runAsync('UPDATE invoices SET return_of_id = NULL WHERE return_of_id = ?', [id]);
    await db.runAsync('DELETE FROM payments WHERE invoice_id = ?', [id]);
    await db.runAsync('DELETE FROM invoice_snapshots WHERE invoice_id = ?', [id]);
    await db.runAsync('DELETE FROM invoice_lines WHERE invoice_id = ?', [id]);
    await db.runAsync('DELETE FROM invoices WHERE id = ?', [id]);
  } catch (err) {
    console.error('Error deleting record:', err);
    throw err;
  }
}

// ─── Invoice lines (for preview screen) ──────────────────────────────────────

export async function getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY line_no', [invoiceId]
  );
  return rows.map(rowToLine);
}

// ─── Business Snapshot ────────────────────────────────────────────────────────

export interface BusinessSnapshot {
  documentsToday: number;
  amountTodayPaise: number;
  pendingPaymentsCount: number;
  pendingAmountPaise: number;
}

export async function getBusinessSnapshot(businessId: string): Promise<BusinessSnapshot> {
  const db = await getDb();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const today = await db.getFirstAsync<{ count: number; amount: number }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(total_paise), 0) as amount
     FROM invoices
     WHERE business_id = ? AND state != 'draft' AND issued_at >= ?`,
    [businessId, startOfToday.toISOString()]
  );

  const pending = await db.getFirstAsync<{ count: number; amount: number }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(total_paise), 0) as amount
     FROM invoices
     WHERE business_id = ? AND state != 'draft' AND payment_state != 'paid'`,
    [businessId]
  );

  return {
    documentsToday:       today?.count ?? 0,
    amountTodayPaise:      today?.amount ?? 0,
    pendingPaymentsCount:  pending?.count ?? 0,
    pendingAmountPaise:    pending?.amount ?? 0,
  };
}

// ─── Global Search (across all document types) ───────────────────────────────

export interface GlobalSearchInvoice {
  id: string;
  number: string;
  totalPaise: number;
  issuedAt?: string;
  createdAt: string;
  customerName?: string;
  typeName: string;
}

export async function searchAllInvoices(
  businessId: string, query: string, limit = 20
): Promise<GlobalSearchInvoice[]> {
  const db = await getDb();
  const like = `%${query.trim()}%`;
  const rows = await db.getAllAsync<any>(
    `SELECT i.id, i.number, i.total_paise, i.issued_at, i.created_at,
            c.name AS customer_name, t.name AS type_name
     FROM invoices i
     JOIN template_versions tv ON i.template_version_id = tv.id
     JOIN templates t ON tv.template_id = t.id
     LEFT JOIN customers c ON i.customer_id = c.id
     WHERE i.business_id = ? AND i.state != 'draft' AND (
       i.number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.gstin LIKE ? OR
       CAST(i.total_paise AS TEXT) LIKE ?
     )
     ORDER BY i.issued_at DESC
     LIMIT ?`,
    [businessId, like, like, like, like, like, limit]
  );
  return rows.map(r => ({
    id:           r.id,
    number:       r.number ?? '',
    totalPaise:   r.total_paise,
    issuedAt:     r.issued_at ?? undefined,
    createdAt:    r.created_at,
    customerName: r.customer_name ?? undefined,
    typeName:     r.type_name,
  }));
}

export async function getInvoicesByCustomer(
  customerId: string, limit = 50
): Promise<GlobalSearchInvoice[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT i.id, i.number, i.total_paise, i.issued_at, i.created_at, t.name AS type_name
     FROM invoices i
     JOIN template_versions tv ON i.template_version_id = tv.id
     JOIN templates t ON tv.template_id = t.id
     WHERE i.customer_id = ? AND i.state != 'draft'
     ORDER BY i.issued_at DESC
     LIMIT ?`,
    [customerId, limit]
  );
  return rows.map(r => ({
    id:         r.id,
    number:     r.number ?? '',
    totalPaise: r.total_paise,
    issuedAt:   r.issued_at ?? undefined,
    createdAt:  r.created_at,
    typeName:   r.type_name,
  }));
}

export async function getOutstandingByCustomer(customerId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ amount: number }>(
    `SELECT COALESCE(SUM(total_paise), 0) as amount
     FROM invoices
     WHERE customer_id = ? AND state != 'draft' AND payment_state != 'paid'`,
    [customerId]
  );
  return row?.amount ?? 0;
}
