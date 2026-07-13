import { getDb } from '../database/db';
import { generateId, nowIso } from '../utils/id';

export interface ItemHistoryEntry {
  id: string;
  businessId: string;
  name: string;
  lastUnit?: string;
  lastRate?: number;
  lastGstPct?: number;
  lastHsn?: string;
  timesUsed: number;
  lastUsedAt: string;
}

function rowToEntry(row: any): ItemHistoryEntry {
  return {
    id:         row.id,
    businessId: row.business_id,
    name:       row.name,
    lastUnit:   row.last_unit ?? undefined,
    lastRate:   row.last_rate ?? undefined,
    lastGstPct: row.last_gst_pct ?? undefined,
    lastHsn:    row.last_hsn ?? undefined,
    timesUsed:  row.times_used,
    lastUsedAt: row.last_used_at,
  };
}

/** Debounced type-ahead source for Add Item — mirrors customerService.searchCustomers(). */
export async function searchItemHistory(businessId: string, query: string): Promise<ItemHistoryEntry[]> {
  const db = await getDb();
  const q = `%${query}%`;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM item_history
     WHERE business_id = ? AND name LIKE ?
     ORDER BY times_used DESC, last_used_at DESC LIMIT 10`,
    [businessId, q]
  );
  return rows.map(rowToEntry);
}

/**
 * Upsert on every Add/Update Item — one row per distinct item name,
 * remembering its most recent unit/rate/GST/HSN so future entry is faster.
 * Fire-and-forget from the caller; not on the critical path of saving the item.
 */
export async function recordItemUsage(
  businessId: string,
  data: { name: string; unit?: string; rate?: number; gstPct?: number; hsn?: string }
): Promise<void> {
  const name = data.name.trim();
  if (!name) return;

  const db  = await getDb();
  const now = nowIso();

  await db.runAsync(
    `INSERT INTO item_history
       (id, business_id, name, last_unit, last_rate, last_gst_pct, last_hsn, times_used, last_used_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT (business_id, name COLLATE NOCASE) DO UPDATE SET
       last_unit    = excluded.last_unit,
       last_rate    = excluded.last_rate,
       last_gst_pct = excluded.last_gst_pct,
       last_hsn     = excluded.last_hsn,
       times_used   = times_used + 1,
       last_used_at = excluded.last_used_at`,
    [generateId(), businessId, name, data.unit ?? null, data.rate ?? null, data.gstPct ?? null, data.hsn ?? null, now, now]
  );
}

/** Recently used units, derived from item_history — no separate units table needed. */
export async function getRecentUnits(businessId: string, limit = 8): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ last_unit: string }>(
    `SELECT DISTINCT last_unit FROM item_history
     WHERE business_id = ? AND last_unit IS NOT NULL AND last_unit != ''
     ORDER BY last_used_at DESC LIMIT ?`,
    [businessId, limit]
  );
  return rows.map(r => r.last_unit);
}
