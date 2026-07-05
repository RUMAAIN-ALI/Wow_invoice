import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '../database/db';
import { saveAiTemplateVersion } from './templateService';
import { computeStaticSignature } from './templateValidator';

// ─── AsyncStorage key helpers (mirrors designStorage.ts) ─────────────────────

const DESIGN_KEY = (templateId: string) => `inv_design_v1_${templateId}`;
const HTML_KEY   = (rawId: string)      => `inv_ai_html_v1_${rawId}`;
const NAME_KEY   = (rawId: string)      => `inv_ai_name_v1_${rawId}`;

/**
 * Migrates a single template's active AI design from AsyncStorage to SQLite.
 *
 * Idempotent: if the version ID already exists in template_versions, no-op.
 * Restart-safe: only updates the design pointer after the SQLite row is committed.
 */
export async function migrateAiDesignIfNeeded(templateId: string): Promise<void> {
  const designId = await AsyncStorage.getItem(DESIGN_KEY(templateId));
  if (!designId?.startsWith('ai_')) return;

  const rawId = designId.replace('ai_', '');

  // Already migrated if a template_version row exists with this exact ID
  const db       = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM template_versions WHERE id = ? AND renderer_type = 'html'`,
    [rawId]
  );
  if (existing) return;

  const [html, name] = await Promise.all([
    AsyncStorage.getItem(HTML_KEY(rawId)),
    AsyncStorage.getItem(NAME_KEY(rawId)),
  ]);
  if (!html) return;

  const displayName = name ?? 'AI Template';
  const signature   = computeStaticSignature(html, 'html', displayName);

  // saveAiTemplateVersion generates its own ID; we can't re-use rawId because
  // it was an AsyncStorage UUID, not a template_versions PK.
  const newVersionId = await saveAiTemplateVersion(
    templateId,
    displayName,
    html,
    undefined,   // metadata (no stored metadata for legacy templates)
    undefined,   // validation (deferred to ensureValidated on first open)
    signature,
  );

  // Update the design pointer to the new SQLite-backed version ID
  await AsyncStorage.setItem(DESIGN_KEY(templateId), `ai_${newVersionId}`);
}
