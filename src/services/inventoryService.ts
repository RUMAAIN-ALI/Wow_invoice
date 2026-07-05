import { getDb } from '../database/db';
import { Product, Batch, ProductUnit } from '../types';
import { generateId, nowIso } from '../utils/id';

// ─── Row mappers ─────────────────────────────────────────────────────────────

function rowToProduct(row: any): Product {
  return {
    id:              row.id,
    businessId:      row.business_id,
    name:            row.name,
    sku:             row.sku ?? undefined,
    hsn:             row.hsn ?? undefined,
    unit:            row.unit as ProductUnit,
    category:        row.category ?? undefined,
    taxRate:         row.tax_rate,
    taxInclusive:    row.tax_inclusive === 1,
    trackInventory:  row.track_inventory === 1,
    trackBatches:    row.track_batches === 1,
    qtyAvailable:    row.qty_available,
    reorderLevel:    row.reorder_level ?? undefined,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

function rowToBatch(row: any): Batch {
  return {
    id:              row.id,
    businessId:      row.business_id,
    productId:       row.product_id,
    batchNo:         row.batch_no,
    expiryDate:      row.expiry_date ?? undefined,
    mrpPaise:        row.mrp_paise ?? undefined,
    costPricePaise:  row.cost_price_paise ?? undefined,
    qtyAvailable:    row.qty_available,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function getProducts(businessId: string): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM products WHERE business_id = ? ORDER BY name ASC',
    [businessId]
  );
  return rows.map(rowToProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM products WHERE id = ?', [id]);
  return row ? rowToProduct(row) : null;
}

export async function createProduct(
  businessId: string,
  data: {
    name: string; sku?: string; hsn?: string; unit?: ProductUnit;
    category?: string; taxRate?: number; taxInclusive?: boolean;
    trackInventory?: boolean; trackBatches?: boolean; reorderLevel?: number;
  }
): Promise<Product> {
  const db  = await getDb();
  const id  = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO products
       (id, business_id, name, sku, hsn, unit, category, tax_rate, tax_inclusive,
        track_inventory, track_batches, qty_available, reorder_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id, businessId, data.name, data.sku ?? null, data.hsn ?? null,
      data.unit ?? 'pcs', data.category ?? null,
      data.taxRate ?? 0, data.taxInclusive ? 1 : 0,
      data.trackInventory !== false ? 1 : 0,
      data.trackBatches ? 1 : 0,
      data.reorderLevel ?? null, now, now,
    ]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM products WHERE id = ?', [id]);
  return rowToProduct(row!);
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<Product, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const db = await getDb();
  const pairs: string[] = [];
  const vals: any[] = [];

  if (data.name           !== undefined) { pairs.push('name = ?');             vals.push(data.name); }
  if (data.sku            !== undefined) { pairs.push('sku = ?');              vals.push(data.sku); }
  if (data.hsn            !== undefined) { pairs.push('hsn = ?');              vals.push(data.hsn); }
  if (data.unit           !== undefined) { pairs.push('unit = ?');             vals.push(data.unit); }
  if (data.category       !== undefined) { pairs.push('category = ?');         vals.push(data.category); }
  if (data.taxRate        !== undefined) { pairs.push('tax_rate = ?');         vals.push(data.taxRate); }
  if (data.taxInclusive   !== undefined) { pairs.push('tax_inclusive = ?');    vals.push(data.taxInclusive ? 1 : 0); }
  if (data.trackInventory !== undefined) { pairs.push('track_inventory = ?');  vals.push(data.trackInventory ? 1 : 0); }
  if (data.trackBatches   !== undefined) { pairs.push('track_batches = ?');    vals.push(data.trackBatches ? 1 : 0); }
  if (data.qtyAvailable   !== undefined) { pairs.push('qty_available = ?');    vals.push(data.qtyAvailable); }
  if (data.reorderLevel   !== undefined) { pairs.push('reorder_level = ?');    vals.push(data.reorderLevel); }

  if (pairs.length === 0) return;
  pairs.push('updated_at = ?');
  vals.push(nowIso());
  vals.push(id);
  await db.runAsync(`UPDATE products SET ${pairs.join(', ')} WHERE id = ?`, vals);
}

export async function searchProducts(businessId: string, query: string): Promise<Product[]> {
  const db = await getDb();
  const q  = `%${query}%`;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM products
     WHERE business_id = ? AND (name LIKE ? OR sku LIKE ?)
     ORDER BY name ASC LIMIT 30`,
    [businessId, q, q]
  );
  return rows.map(rowToProduct);
}

// ─── Batches ─────────────────────────────────────────────────────────────────

export async function getBatchesByProduct(productId: string): Promise<Batch[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM batches WHERE product_id = ? ORDER BY expiry_date ASC',
    [productId]
  );
  return rows.map(rowToBatch);
}

export async function getActiveBatches(productId: string): Promise<Batch[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM batches WHERE product_id = ? AND qty_available > 0 ORDER BY expiry_date ASC',
    [productId]
  );
  return rows.map(rowToBatch);
}

export async function createBatch(
  productId: string,
  data: {
    batchNo: string; expiryDate?: string;
    mrpPaise?: number; costPricePaise?: number; qtyAvailable?: number;
  }
): Promise<Batch> {
  const db  = await getDb();
  const product = await db.getFirstAsync<{ business_id: string }>(
    'SELECT business_id FROM products WHERE id = ?', [productId]
  );
  if (!product) throw new Error('Product not found');

  const id  = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO batches
       (id, business_id, product_id, batch_no, expiry_date, mrp_paise,
        cost_price_paise, qty_available, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, product.business_id, productId, data.batchNo,
      data.expiryDate ?? null, data.mrpPaise ?? null,
      data.costPricePaise ?? null, data.qtyAvailable ?? 0, now, now,
    ]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM batches WHERE id = ?', [id]);
  return rowToBatch(row!);
}

export async function deductStock(batchId: string, qty: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE batches SET qty_available = qty_available - ?, updated_at = ? WHERE id = ?`,
    [qty, nowIso(), batchId]
  );
}

export async function restoreStock(batchId: string, qty: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE batches SET qty_available = qty_available + ?, updated_at = ? WHERE id = ?`,
    [qty, nowIso(), batchId]
  );
}
