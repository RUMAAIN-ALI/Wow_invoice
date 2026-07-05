import { getDb } from '../database/db';
import { PrintProfile, PrintPaperWidth, PrintFontSize } from '../types';
import { getSession } from './businessService';
import { generateId, nowIso } from '../utils/id';

function rowToProfile(row: any): PrintProfile {
  return {
    id:            row.id,
    businessId:    row.business_id,
    name:          row.name,
    templateId:    row.template_id || 'classic',
    paperWidth:    row.paper_width as PrintPaperWidth,
    fontSize:      row.font_size as PrintFontSize,
    showLogo:      row.show_logo === 1,
    showGstin:     row.show_gstin === 1,
    showUpi:       row.show_upi === 1,
    showSignature: row.show_signature === 1,
    isDefault:     row.is_default === 1,
    themeOverridesJson: row.theme_json || undefined,
    preferencesJson: row.preferences_json || undefined,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

export async function ensureDefaultPrintProfile(): Promise<PrintProfile> {
  const db = await getDb();
  const { businessId } = getSession();

  const existing = await db.getFirstAsync<any>(
    'SELECT * FROM print_profiles WHERE business_id = ? AND is_default = 1 LIMIT 1',
    [businessId]
  );
  if (existing) return rowToProfile(existing);

  const now = nowIso();
  const id  = generateId();
  await db.runAsync(
    `INSERT INTO print_profiles
       (id, business_id, name, template_id, paper_width, font_size, show_logo, show_gstin, show_upi, show_signature, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, businessId, 'Default', 'classic', 'a4', 'medium', 1, 1, 1, 1, 1, now, now]
  );

  const row = await db.getFirstAsync<any>('SELECT * FROM print_profiles WHERE id = ?', [id]);
  return rowToProfile(row!);
}

export async function getActivePrintProfile(): Promise<PrintProfile> {
  const db = await getDb();
  const { businessId } = getSession();

  // Return the default (active) profile, fallback to ensuring one exists
  const active = await db.getFirstAsync<any>(
    'SELECT * FROM print_profiles WHERE business_id = ? AND is_default = 1 LIMIT 1',
    [businessId]
  );
  if (active) return rowToProfile(active);

  return ensureDefaultPrintProfile();
}

export async function listPrintProfiles(): Promise<PrintProfile[]> {
  const db = await getDb();
  const { businessId } = getSession();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM print_profiles WHERE business_id = ? ORDER BY is_default DESC, name ASC',
    [businessId]
  );
  return rows.map(rowToProfile);
}

export async function getPrintProfileById(id: string): Promise<PrintProfile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM print_profiles WHERE id = ?', [id]);
  return row ? rowToProfile(row) : null;
}

export async function createPrintProfile(
  name: string,
  templateId: string,
  themeOverridesJson?: string,
  preferencesJson?: string
): Promise<PrintProfile> {
  const db = await getDb();
  const { businessId } = getSession();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO print_profiles
       (id, business_id, name, template_id, paper_width, font_size, show_logo, show_gstin, show_upi, show_signature, is_default, theme_json, preferences_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, businessId, name, templateId, 'a4', 'medium', 1, 1, 1, 1, 0, themeOverridesJson ?? null, preferencesJson ?? null, now, now]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM print_profiles WHERE id = ?', [id]);
  return rowToProfile(row!);
}

export async function deletePrintProfile(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM print_profiles WHERE id = ? AND is_default = 0', [id]);
}

export async function setDefaultPrintProfile(id: string): Promise<void> {
  const db = await getDb();
  const { businessId } = getSession();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE print_profiles SET is_default = 0 WHERE business_id = ?', [businessId]);
    await db.runAsync('UPDATE print_profiles SET is_default = 1 WHERE id = ?', [id]);
  });
}

export async function updatePrintProfileById(
  id: string,
  updates: {
    name?:          string;
    templateId?:    string;
    paperWidth?:    PrintPaperWidth;
    fontSize?:      PrintFontSize;
    showLogo?:      boolean;
    showGstin?:     boolean;
    showUpi?:       boolean;
    showSignature?: boolean;
    themeOverridesJson?: string | null;
    preferencesJson?: string | null;
  }
): Promise<void> {
  const db = await getDb();

  const pairs: string[] = [];
  const vals:  any[]    = [];

  if (updates.name           !== undefined) { pairs.push('name = ?');            vals.push(updates.name); }
  if (updates.templateId     !== undefined) { pairs.push('template_id = ?');     vals.push(updates.templateId); }
  if (updates.paperWidth    !== undefined) { pairs.push('paper_width = ?');    vals.push(updates.paperWidth); }
  if (updates.fontSize      !== undefined) { pairs.push('font_size = ?');      vals.push(updates.fontSize); }
  if (updates.showLogo      !== undefined) { pairs.push('show_logo = ?');      vals.push(updates.showLogo ? 1 : 0); }
  if (updates.showGstin     !== undefined) { pairs.push('show_gstin = ?');     vals.push(updates.showGstin ? 1 : 0); }
  if (updates.showUpi       !== undefined) { pairs.push('show_upi = ?');       vals.push(updates.showUpi ? 1 : 0); }
  if (updates.showSignature !== undefined) { pairs.push('show_signature = ?'); vals.push(updates.showSignature ? 1 : 0); }
  if (updates.themeOverridesJson !== undefined) { pairs.push('theme_json = ?');     vals.push(updates.themeOverridesJson); }
  if (updates.preferencesJson !== undefined) { pairs.push('preferences_json = ?'); vals.push(updates.preferencesJson); }

  if (pairs.length === 0) return;
  pairs.push('updated_at = ?');
  vals.push(nowIso());
  vals.push(id);

  await db.runAsync(`UPDATE print_profiles SET ${pairs.join(', ')} WHERE id = ?`, vals);
}

export async function updatePrintProfile(updates: {
  templateId?:    string;
  paperWidth?:    PrintPaperWidth;
  fontSize?:      PrintFontSize;
  showLogo?:      boolean;
  showGstin?:     boolean;
  showUpi?:       boolean;
  showSignature?: boolean;
  themeOverridesJson?: string | null;
  preferencesJson?: string | null;
}): Promise<void> {
  const profile = await getActivePrintProfile();
  await updatePrintProfileById(profile.id, updates);
}
