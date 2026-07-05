import { getDb } from '../database/db';
import { Business, Worker, Device, BusinessType } from '../types';
import { generateId, nowIso } from '../utils/id';

// ─── In-memory session ────────────────────────────────────────────────────────

interface Session {
  businessId: string;
  workerId: string;
  deviceId: string;
}

let _session: Session | null = null;

export function setSession(businessId: string, workerId: string, deviceId: string): void {
  _session = { businessId, workerId, deviceId };
}

export function getSession(): Session {
  if (!_session) throw new Error('Session not initialised — call bootstrapIfNeeded first');
  return _session;
}

export function hasSession(): boolean {
  return _session !== null;
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function rowToBusiness(row: any): Business {
  return {
    id:                  row.id,
    name:                row.name,
    type:                row.type as BusinessType,
    gstin:               row.gstin ?? undefined,
    address:             row.address ?? undefined,
    city:                row.city ?? undefined,
    stateName:           row.state_name ?? undefined,
    phone:               row.phone ?? undefined,
    email:               row.email ?? undefined,
    brandColor:          row.brand_color,
    logoPath:            row.logo_path ?? undefined,
    licenseNumber:       row.license_number ?? undefined,
    upiId:               row.upi_id ?? undefined,
    bankName:            row.bank_name ?? undefined,
    accountNumber:       row.account_number ?? undefined,
    ifsc:                row.ifsc ?? undefined,
    invoicePrefix:        row.invoice_prefix ?? 'INV-',
    invoiceStartNumber:   row.invoice_start_number ?? 1,
    customBusinessType:   row.custom_business_type ?? undefined,
    footerMessage:        row.footer_message ?? undefined,
    createdAt:            row.created_at,
    updatedAt:           row.updated_at,
  };
}

function rowToWorker(row: any): Worker {
  return {
    id:         row.id,
    businessId: row.business_id,
    name:       row.name,
    role:       row.role,
    pinHash:    row.pin_hash ?? undefined,
    active:     row.active === 1,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  };
}

// ─── Business ────────────────────────────────────────────────────────────────

export async function getActiveBusiness(): Promise<Business | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM businesses LIMIT 1');
  return row ? rowToBusiness(row) : null;
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM businesses WHERE id = ?', [id]);
  return row ? rowToBusiness(row) : null;
}

export async function updateBusiness(id: string, updates: {
  name?: string;
  type?: BusinessType;
  gstin?: string;
  address?: string;
  city?: string;
  stateName?: string;
  phone?: string;
  email?: string;
  brandColor?: string;
  logoPath?: string;
  licenseNumber?: string;
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  invoicePrefix?: string;
  invoiceStartNumber?: number;
  customBusinessType?: string;
  footerMessage?: string;
}): Promise<void> {
  const db = await getDb();
  const pairs: string[] = [];
  const vals: any[] = [];

  if (updates.name               !== undefined) { pairs.push('name = ?');                 vals.push(updates.name); }
  if (updates.type               !== undefined) { pairs.push('type = ?');                 vals.push(updates.type); }
  if (updates.gstin              !== undefined) { pairs.push('gstin = ?');                vals.push(updates.gstin || null); }
  if (updates.address            !== undefined) { pairs.push('address = ?');              vals.push(updates.address || null); }
  if (updates.city               !== undefined) { pairs.push('city = ?');                 vals.push(updates.city || null); }
  if (updates.stateName          !== undefined) { pairs.push('state_name = ?');           vals.push(updates.stateName || null); }
  if (updates.phone              !== undefined) { pairs.push('phone = ?');                vals.push(updates.phone || null); }
  if (updates.email              !== undefined) { pairs.push('email = ?');                vals.push(updates.email || null); }
  if (updates.brandColor         !== undefined) { pairs.push('brand_color = ?');          vals.push(updates.brandColor); }
  if (updates.logoPath           !== undefined) { pairs.push('logo_path = ?');            vals.push(updates.logoPath || null); }
  if (updates.licenseNumber      !== undefined) { pairs.push('license_number = ?');       vals.push(updates.licenseNumber || null); }
  if (updates.upiId              !== undefined) { pairs.push('upi_id = ?');               vals.push(updates.upiId || null); }
  if (updates.bankName           !== undefined) { pairs.push('bank_name = ?');            vals.push(updates.bankName || null); }
  if (updates.accountNumber      !== undefined) { pairs.push('account_number = ?');       vals.push(updates.accountNumber || null); }
  if (updates.ifsc               !== undefined) { pairs.push('ifsc = ?');                 vals.push(updates.ifsc || null); }
  if (updates.invoicePrefix      !== undefined) { pairs.push('invoice_prefix = ?');       vals.push(updates.invoicePrefix || 'INV-'); }
  if (updates.invoiceStartNumber  !== undefined) { pairs.push('invoice_start_number = ?');    vals.push(updates.invoiceStartNumber); }
  if (updates.customBusinessType  !== undefined) { pairs.push('custom_business_type = ?');    vals.push(updates.customBusinessType || null); }
  if (updates.footerMessage       !== undefined) { pairs.push('footer_message = ?');           vals.push(updates.footerMessage || null); }

  if (pairs.length === 0) return;
  pairs.push('updated_at = ?');
  vals.push(nowIso());
  vals.push(id);
  await db.runAsync(`UPDATE businesses SET ${pairs.join(', ')} WHERE id = ?`, vals);
}

// ─── Worker ──────────────────────────────────────────────────────────────────

export async function getActiveWorker(): Promise<Worker | null> {
  if (!_session) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM workers WHERE id = ?', [_session.workerId]
  );
  return row ? rowToWorker(row) : null;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
// Creates a default business + owner + device on first launch.
// Safe to call on every app start — no-ops if already set up.

export async function bootstrapIfNeeded(): Promise<void> {
  const db = await getDb();

  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM businesses LIMIT 1'
  );

  if (!existing) {
    const now = nowIso();
    const businessId = generateId();
    const workerId   = generateId();
    const deviceId   = generateId();

    await db.runAsync(
      `INSERT INTO businesses
         (id, name, type, brand_color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [businessId, 'My Business', 'service', '#F97316', now, now]
    );

    await db.runAsync(
      `INSERT INTO workers
         (id, business_id, name, role, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [workerId, businessId, 'Owner', 'owner', 1, now, now]
    );

    await db.runAsync(
      `INSERT INTO devices
         (id, business_id, fingerprint, platform, registered_at)
       VALUES (?, ?, ?, ?, ?)`,
      [deviceId, businessId, deviceId, 'android', now]
    );

    setSession(businessId, workerId, deviceId);
  } else {
    const worker = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workers WHERE business_id = ? AND active = 1 LIMIT 1',
      [existing.id]
    );
    const device = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM devices WHERE business_id = ? LIMIT 1',
      [existing.id]
    );
    setSession(existing.id, worker!.id, device!.id);
  }
}

// ─── Settings view (screen compatibility) ────────────────────────────────────

export async function getBusinessSettings() {
  const biz = await getActiveBusiness();
  if (!biz) return null;
  return {
    id:                  biz.id,
    name:                biz.name,
    type:                biz.type,
    brandColor:          biz.brandColor,
    address:             biz.address,
    city:                biz.city,
    stateName:           biz.stateName,
    phone:               biz.phone,
    email:               biz.email,
    gstin:               biz.gstin,
    licenseNumber:       biz.licenseNumber,
    logo:                biz.logoPath,
    upiId:               biz.upiId,
    bankName:            biz.bankName,
    accountNumber:       biz.accountNumber,
    ifsc:                biz.ifsc,
    invoicePrefix:        biz.invoicePrefix,
    invoiceStartNumber:   biz.invoiceStartNumber,
    customBusinessType:   biz.customBusinessType,
    footerMessage:        biz.footerMessage,
  };
}

export async function updateBusinessSettings(settings: {
  name?: string; type?: BusinessType; brandColor?: string;
  address?: string; city?: string; stateName?: string;
  phone?: string; email?: string; gstin?: string; licenseNumber?: string;
  logo?: string; upiId?: string; bankName?: string;
  accountNumber?: string; ifsc?: string;
  invoicePrefix?: string; invoiceStartNumber?: number; customBusinessType?: string; footerMessage?: string;
}): Promise<void> {
  const biz = await getActiveBusiness();
  if (!biz) return;
  await updateBusiness(biz.id, {
    name:                settings.name,
    type:                settings.type,
    brandColor:          settings.brandColor,
    address:             settings.address,
    city:                settings.city,
    stateName:           settings.stateName,
    phone:               settings.phone,
    email:               settings.email,
    gstin:               settings.gstin,
    licenseNumber:       settings.licenseNumber,
    logoPath:            settings.logo,
    upiId:               settings.upiId,
    bankName:            settings.bankName,
    accountNumber:       settings.accountNumber,
    ifsc:                settings.ifsc,
    invoicePrefix:        settings.invoicePrefix,
    invoiceStartNumber:   settings.invoiceStartNumber,
    customBusinessType:   settings.customBusinessType,
    footerMessage:        settings.footerMessage,
  });
}
