import { getDb } from '../database/db';
import { NumberBlock } from '../types';
import { generateId, nowIso } from '../utils/id';

const BLOCK_SIZE = 500; // local-only blocks are large; server will assign smaller ones in Phase 5

function rowToBlock(row: any): NumberBlock {
  return {
    id:            row.id,
    businessId:    row.business_id,
    entityType:    row.entity_type,
    prefix:        row.prefix,
    blockStart:    row.block_start,
    blockEnd:      row.block_end,
    nextAvailable: row.next_available,
    exhausted:     row.exhausted === 1,
    receivedAt:    row.received_at,
  };
}

export async function getActiveBlock(
  businessId: string,
  entityType: string
): Promise<NumberBlock | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM number_blocks
     WHERE business_id = ? AND entity_type = ? AND exhausted = 0
     ORDER BY block_start ASC LIMIT 1`,
    [businessId, entityType]
  );
  return row ? rowToBlock(row) : null;
}

export async function consumeNumber(
  businessId: string,
  entityType: string
): Promise<string> {
  const db = await getDb();

  let block = await getActiveBlock(businessId, entityType);

  if (!block) {
    block = await seedLocalBlock(businessId, entityType);
  }

  const num = block.nextAvailable;
  const nextNext = num + 1;
  const exhausted = nextNext > block.blockEnd ? 1 : 0;

  await db.runAsync(
    `UPDATE number_blocks SET next_available = ?, exhausted = ? WHERE id = ?`,
    [nextNext, exhausted, block.id]
  );

  const padded = String(num).padStart(4, '0');
  return `${block.prefix}-${padded}`;
}

export async function seedLocalBlock(
  businessId: string,
  entityType: string,
  prefix?: string
): Promise<NumberBlock> {
  const db = await getDb();

  const prefixMap: Record<string, string> = {
    invoice:        'INV',
    return:         'RET',
    purchase_order: 'PO',
    expense:        'EXP',
  };

  const blockPrefix = prefix ?? prefixMap[entityType] ?? 'DOC';

  // Find the highest block_end for this entity type to avoid gaps
  const last = await db.getFirstAsync<{ block_end: number | null }>(
    `SELECT MAX(block_end) as block_end FROM number_blocks
     WHERE business_id = ? AND entity_type = ?`,
    [businessId, entityType]
  );

  const start = (last?.block_end ?? 0) + 1;
  const end   = start + BLOCK_SIZE - 1;
  const id    = generateId();
  const now   = nowIso();

  await db.runAsync(
    `INSERT INTO number_blocks
       (id, business_id, entity_type, prefix, block_start, block_end,
        next_available, exhausted, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, businessId, entityType, blockPrefix, start, end, start, now]
  );

  const row = await db.getFirstAsync<any>('SELECT * FROM number_blocks WHERE id = ?', [id]);
  return rowToBlock(row!);
}

export async function ensureLocalBlocks(businessId: string): Promise<void> {
  const types = ['invoice', 'return', 'purchase_order', 'expense'];
  for (const t of types) {
    const existing = await getActiveBlock(businessId, t);
    if (!existing) await seedLocalBlock(businessId, t);
  }
}

export function generateTmpNumber(deviceId: string, entityType: string): string {
  const short = deviceId.replace(/-/g, '').slice(0, 3).toUpperCase();
  const date  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq   = String(Date.now()).slice(-4);
  const prefix = entityType === 'invoice' ? 'TMP' : `T${entityType.slice(0, 2).toUpperCase()}`;
  return `${prefix}-${short}-${date}-${seq}`;
}
