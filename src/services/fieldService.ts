import { getDb } from '../database/db';
import { SuggestedField } from '../types';
import { generateId } from '../utils/id';

export async function bulkCreateFields(templateId: string, fields: SuggestedField[]): Promise<void> {
  const db = await getDb();

  const row = await db.getFirstAsync<{ id: string; config: string }>(
    `SELECT tv.id, tv.config
     FROM template_versions tv
     JOIN templates t ON t.current_version_id = tv.id
     WHERE t.id = ?`,
    [templateId]
  );
  if (!row) return;

  const config = JSON.parse(row.config);
  const existing: any[] = config.extraFields ?? [];
  const startOrder = existing.length;

  const newFields = fields.map((f, i) => ({
    id:           generateId(),
    section:      'footer' as const,
    type:         f.type,
    label:        f.name,
    key:          f.name.toLowerCase().replace(/\s+/g, '_'),
    visible:      true,
    required:     f.required,
    order:        startOrder + i,
    placeholder:  null,
    voiceAliases: [],
  }));

  config.extraFields = [...existing, ...newFields];
  await db.runAsync('UPDATE template_versions SET config = ? WHERE id = ?', [
    JSON.stringify(config),
    row.id,
  ]);
}
