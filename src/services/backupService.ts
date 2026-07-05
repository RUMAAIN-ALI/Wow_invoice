import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDb } from '../database/db';
import { nowIso } from '../utils/id';

const BACKUP_TABLES = [
  'businesses', 'workers', 'devices', 'customers', 'suppliers',
  'products', 'batches', 'templates', 'template_versions',
  'number_blocks', 'invoices', 'invoice_lines', 'invoice_snapshots',
  'payments', 'expenses', 'reconciliation_tasks',
];

export async function exportBackup(): Promise<void> {
  const db = await getDb();
  const tables: Record<string, any[]> = {};
  for (const table of BACKUP_TABLES) {
    tables[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }

  const payload = JSON.stringify({ exportedAt: nowIso(), tables });
  const fileName = `rera-backup-${nowIso().replace(/[:.]/g, '-')}.json`;
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(payload);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save invoice backup',
  });
}
