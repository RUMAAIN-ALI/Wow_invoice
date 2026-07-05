import * as SQLite from 'expo-sqlite';

const DB_NAME = 'rera_v2.db';
const SCHEMA_VERSION = 10;

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return db;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  const database = await getDb();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = OFF;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = -8000;
    PRAGMA temp_store = MEMORY;
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const row = await database.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) as version FROM schema_migrations'
  );
  const current = row?.version ?? 0;

  if (current < 1) await migration1(database);
  if (current < 2) await migration2(database);
  if (current < 3) await migration3(database);
  if (current < 4) await migration4(database);
  if (current < 5) await migration5(database);
  if (current < 6) await migration6(database);
  if (current < 7) await migration7(database);
  if (current < 8) await migration8(database);
  if (current < 9) await migration9(database);
  if (current < 10) await migration10(database);
}

// ─── Migration 10 — Add signature_path to businesses ────────────────────────

async function migration10(db: SQLite.SQLiteDatabase): Promise<void> {
  try { await db.execAsync(`ALTER TABLE businesses ADD COLUMN signature_path TEXT`); } catch { /* column already exists */ }
  await db.runAsync(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
    [10, new Date().toISOString()]
  );
}

// ─── Migration 9 — Add template_id to print_profiles and backfill ───────────

async function migration9(db: SQLite.SQLiteDatabase): Promise<void> {
  try { await db.execAsync(`ALTER TABLE print_profiles ADD COLUMN template_id TEXT`); } catch { /* column already exists */ }
  
  // One-time inference migration to decouple templates from font families forever
  const profiles = await db.getAllAsync<any>('SELECT id, theme_json FROM print_profiles');
  for (const p of profiles) {
    let tId = 'classic';
    if (p.theme_json) {
      try {
        const t = JSON.parse(p.theme_json);
        const font = t.style?.fontFamily;
        if (font === 'Georgia') tId = 'minimal';
        else if (font === 'Helvetica Neue' || font === 'Roboto') tId = 'modern';
      } catch {}
    }
    await db.runAsync('UPDATE print_profiles SET template_id = ? WHERE id = ?', [tId, p.id]);
  }

  await db.runAsync(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
    [9, new Date().toISOString()]
  );
}

// ─── Migration 8 — theme_json + preferences_json in print_profiles ───────────

async function migration8(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const stmt of [
    `ALTER TABLE print_profiles ADD COLUMN theme_json TEXT`,
    `ALTER TABLE print_profiles ADD COLUMN preferences_json TEXT`,
  ]) {
    try { await db.execAsync(stmt); } catch { /* column already exists */ }
  }
  await db.runAsync(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
    [8, new Date().toISOString()]
  );
}

// ─── Migration 7 — footer_message + print_profiles table ─────────────────────

async function migration7(db: SQLite.SQLiteDatabase): Promise<void> {
  try { await db.execAsync(`ALTER TABLE businesses ADD COLUMN footer_message TEXT`); } catch {}

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS print_profiles (
      id            TEXT PRIMARY KEY,
      business_id   TEXT NOT NULL REFERENCES businesses(id),
      name          TEXT NOT NULL DEFAULT 'Default',
      paper_width   TEXT NOT NULL DEFAULT 'thermal_80'
                      CHECK (paper_width IN ('thermal_58', 'thermal_80', 'a4')),
      font_size     TEXT NOT NULL DEFAULT 'medium'
                      CHECK (font_size IN ('small', 'medium', 'large')),
      show_logo     INTEGER NOT NULL DEFAULT 1,
      show_gstin    INTEGER NOT NULL DEFAULT 1,
      show_upi      INTEGER NOT NULL DEFAULT 1,
      show_signature INTEGER NOT NULL DEFAULT 1,
      is_default    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_print_profiles_business
      ON print_profiles (business_id, is_default);
  `);

  await db.runAsync(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
    [7, new Date().toISOString()]
  );
}

// ─── Migration 5 — payment, invoice numbering, business type fields ───────────

async function migration6(db: SQLite.SQLiteDatabase): Promise<void> {
  try { await db.execAsync(`ALTER TABLE businesses ADD COLUMN custom_business_type TEXT`); } catch {}
  await db.runAsync(`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`, [6, new Date().toISOString()]);
}

async function migration5(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const stmt of [
    `ALTER TABLE businesses ADD COLUMN upi_id TEXT`,
    `ALTER TABLE businesses ADD COLUMN bank_name TEXT`,
    `ALTER TABLE businesses ADD COLUMN account_number TEXT`,
    `ALTER TABLE businesses ADD COLUMN ifsc TEXT`,
    `ALTER TABLE businesses ADD COLUMN invoice_prefix TEXT NOT NULL DEFAULT 'INV-'`,
    `ALTER TABLE businesses ADD COLUMN invoice_start_number INTEGER NOT NULL DEFAULT 1`,
  ]) {
    try { await db.execAsync(stmt); } catch { /* column already exists */ }
  }
  await db.runAsync(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
    [5, new Date().toISOString()]
  );
}

// ─── Migration 4 — renderer_type / payload / industry / language ─────────────

async function migration4(db: SQLite.SQLiteDatabase): Promise<void> {
  // template_versions: add renderer_type, payload, style, validation_json, static_signature_json
  for (const stmt of [
    `ALTER TABLE template_versions ADD COLUMN renderer_type TEXT NOT NULL DEFAULT 'form'`,
    `ALTER TABLE template_versions ADD COLUMN payload TEXT`,
    `ALTER TABLE template_versions ADD COLUMN style TEXT`,
    `ALTER TABLE template_versions ADD COLUMN validation_json TEXT`,
    `ALTER TABLE template_versions ADD COLUMN static_signature_json TEXT`,
  ]) {
    try { await db.execAsync(stmt); } catch { /* column already exists */ }
  }

  // templates: add industry, language
  for (const stmt of [
    `ALTER TABLE templates ADD COLUMN industry TEXT`,
    `ALTER TABLE templates ADD COLUMN language TEXT NOT NULL DEFAULT 'en-IN'`,
  ]) {
    try { await db.execAsync(stmt); } catch { /* column already exists */ }
  }

  // Backfill: payload = config for all existing form template versions
  await db.execAsync(`UPDATE template_versions SET payload = config WHERE payload IS NULL`);

  try {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_templates_industry
        ON templates (business_id, industry);
      CREATE INDEX IF NOT EXISTS idx_template_versions_renderer
        ON template_versions (template_id, renderer_type);
    `);
  } catch { /* ignore */ }

  await db.runAsync(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
    [4, new Date().toISOString()]
  );
}

// ─── Migration 3 — add template_type column ──────────────────────────────────

async function migration3(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await db.execAsync(
      `ALTER TABLE templates ADD COLUMN template_type TEXT NOT NULL DEFAULT 'transaction_document'`
    );
  } catch { /* already exists */ }

  await db.runAsync(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
    [3, new Date().toISOString()]
  );
}

// ─── Migration 2 — patch templates table + pinned_templates ──────────────────
// Migration 1 used CREATE TABLE IF NOT EXISTS, so installations that already had
// a `templates` table (pre-rewrite) kept the old schema without these columns.

async function migration2(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const stmt of [
    `ALTER TABLE templates ADD COLUMN icon TEXT NOT NULL DEFAULT 'document-text-outline'`,
    `ALTER TABLE templates ADD COLUMN category TEXT NOT NULL DEFAULT 'custom'`,
    `ALTER TABLE templates ADD COLUMN industry_preset TEXT`,
    `ALTER TABLE templates ADD COLUMN state TEXT NOT NULL DEFAULT 'published'`,
    `ALTER TABLE templates ADD COLUMN current_version_id TEXT`,
  ]) {
    try { await db.execAsync(stmt); } catch { /* column already exists — ignore */ }
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pinned_templates (
      template_id   TEXT PRIMARY KEY REFERENCES templates(id) ON DELETE CASCADE,
      pin_order     INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.runAsync(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
    [2, new Date().toISOString()]
  );
}

// ─── Migration 1 — full Document 2 schema ────────────────────────────────────

async function migration1(db: SQLite.SQLiteDatabase): Promise<void> {

  // Drop legacy tables from the prototype phase
  await db.execAsync(`
    DROP TABLE IF EXISTS pinned_document_types;
    DROP TABLE IF EXISTS pinned_templates;
    DROP TABLE IF EXISTS template_versions;
    DROP TABLE IF EXISTS templates;
    DROP TABLE IF EXISTS records;
    DROP TABLE IF EXISTS fields;
    DROP TABLE IF EXISTS document_types;
    DROP TABLE IF EXISTS business_settings;
  `);

  // ── Domain 1: Business & Identity ────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS businesses (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      type             TEXT NOT NULL,
      gstin            TEXT,
      address          TEXT,
      city             TEXT,
      state_name       TEXT,
      phone            TEXT,
      email            TEXT,
      brand_color      TEXT NOT NULL DEFAULT '#2563EB',
      logo_path        TEXT,
      license_number   TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workers (
      id            TEXT PRIMARY KEY,
      business_id   TEXT NOT NULL REFERENCES businesses(id),
      name          TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('owner','manager','cashier','viewer')),
      pin_hash      TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id              TEXT PRIMARY KEY,
      business_id     TEXT NOT NULL REFERENCES businesses(id),
      fingerprint     TEXT NOT NULL UNIQUE,
      platform        TEXT NOT NULL,
      model           TEXT,
      registered_at   TEXT NOT NULL,
      last_seen_at    TEXT
    );
  `);

  // ── Domain 2: Customers & Suppliers ─────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS customers (
      id                  TEXT PRIMARY KEY,
      business_id         TEXT NOT NULL REFERENCES businesses(id),
      name                TEXT NOT NULL,
      phone               TEXT,
      email               TEXT,
      gstin               TEXT,
      address             TEXT,
      city                TEXT,
      state_name          TEXT,
      outstanding_credit  INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id            TEXT PRIMARY KEY,
      business_id   TEXT NOT NULL REFERENCES businesses(id),
      name          TEXT NOT NULL,
      phone         TEXT,
      email         TEXT,
      gstin         TEXT,
      address       TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
  `);

  // ── Domain 3: Inventory ──────────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id               TEXT PRIMARY KEY,
      business_id      TEXT NOT NULL REFERENCES businesses(id),
      name             TEXT NOT NULL,
      sku              TEXT,
      hsn              TEXT,
      unit             TEXT NOT NULL DEFAULT 'pcs',
      category         TEXT,
      tax_rate         INTEGER NOT NULL DEFAULT 0,
      tax_inclusive    INTEGER NOT NULL DEFAULT 0,
      track_inventory  INTEGER NOT NULL DEFAULT 1,
      track_batches    INTEGER NOT NULL DEFAULT 0,
      qty_available    INTEGER NOT NULL DEFAULT 0,
      reorder_level    INTEGER,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id                 TEXT PRIMARY KEY,
      business_id        TEXT NOT NULL REFERENCES businesses(id),
      product_id         TEXT NOT NULL REFERENCES products(id),
      batch_no           TEXT NOT NULL,
      expiry_date        TEXT,
      mrp_paise          INTEGER,
      cost_price_paise   INTEGER,
      qty_available      INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      UNIQUE (product_id, batch_no)
    );
  `);

  // ── Domain 4: Templates ──────────────────────────────────────────────────
  // templates.current_version_id has no FK to break the circular reference
  // with template_versions. Enforced in application code.

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS templates (
      id                  TEXT PRIMARY KEY,
      business_id         TEXT NOT NULL REFERENCES businesses(id),
      name                TEXT NOT NULL,
      icon                TEXT NOT NULL DEFAULT 'document-text-outline',
      category            TEXT NOT NULL DEFAULT 'custom',
      template_type       TEXT NOT NULL DEFAULT 'transaction_document',
      industry_preset     TEXT,
      state               TEXT NOT NULL DEFAULT 'draft'
                            CHECK (state IN ('draft','published','archived')),
      current_version_id  TEXT,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pinned_templates (
      template_id   TEXT PRIMARY KEY REFERENCES templates(id) ON DELETE CASCADE,
      pin_order     INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ── Domain 5: Number Blocks ──────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS number_blocks (
      id              TEXT PRIMARY KEY,
      business_id     TEXT NOT NULL REFERENCES businesses(id),
      entity_type     TEXT NOT NULL,
      prefix          TEXT NOT NULL,
      block_start     INTEGER NOT NULL,
      block_end       INTEGER NOT NULL,
      next_available  INTEGER NOT NULL,
      exhausted       INTEGER NOT NULL DEFAULT 0,
      received_at     TEXT NOT NULL,
      UNIQUE (business_id, entity_type, block_start)
    );
  `);

  // ── Domain 6: Template Versions (after templates + workers) ─────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS template_versions (
      id            TEXT PRIMARY KEY,
      template_id   TEXT NOT NULL REFERENCES templates(id),
      version_no    INTEGER NOT NULL,
      config        TEXT NOT NULL,
      published_at  TEXT NOT NULL,
      published_by  TEXT NOT NULL REFERENCES workers(id),
      UNIQUE (template_id, version_no)
    );
  `);

  // ── Domain 7: Invoices ───────────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS invoices (
      id                    TEXT PRIMARY KEY,
      business_id           TEXT NOT NULL REFERENCES businesses(id),
      template_version_id   TEXT REFERENCES template_versions(id),
      customer_id           TEXT REFERENCES customers(id),
      worker_id             TEXT NOT NULL REFERENCES workers(id),
      device_id             TEXT NOT NULL REFERENCES devices(id),
      number                TEXT,
      number_is_temp        INTEGER NOT NULL DEFAULT 0,
      number_block_id       TEXT REFERENCES number_blocks(id),
      invoice_type          TEXT NOT NULL DEFAULT 'sale'
                              CHECK (invoice_type IN ('sale','return','purchase')),
      state                 TEXT NOT NULL DEFAULT 'draft'
                              CHECK (state IN ('draft','issued','cancelled','returned')),
      subtotal_paise        INTEGER NOT NULL DEFAULT 0,
      discount_paise        INTEGER NOT NULL DEFAULT 0,
      cgst_paise            INTEGER NOT NULL DEFAULT 0,
      sgst_paise            INTEGER NOT NULL DEFAULT 0,
      igst_paise            INTEGER NOT NULL DEFAULT 0,
      cess_paise            INTEGER NOT NULL DEFAULT 0,
      shipping_paise        INTEGER NOT NULL DEFAULT 0,
      round_off_paise       INTEGER NOT NULL DEFAULT 0,
      total_paise           INTEGER NOT NULL DEFAULT 0,
      payment_state         TEXT NOT NULL DEFAULT 'unpaid'
                              CHECK (payment_state IN ('unpaid','partial','paid')),
      payment_method        TEXT,
      return_of_id          TEXT REFERENCES invoices(id),
      notes                 TEXT,
      issued_at             TEXT,
      cancelled_at          TEXT,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id              TEXT PRIMARY KEY,
      invoice_id      TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      line_no         INTEGER NOT NULL,
      product_id      TEXT REFERENCES products(id),
      batch_id        TEXT REFERENCES batches(id),
      item_name       TEXT NOT NULL,
      sku             TEXT,
      hsn             TEXT,
      batch_no        TEXT,
      expiry_date     TEXT,
      unit            TEXT,
      qty             INTEGER NOT NULL,
      free_qty        INTEGER NOT NULL DEFAULT 0,
      mrp_paise       INTEGER,
      price_paise     INTEGER NOT NULL,
      discount_pct    INTEGER NOT NULL DEFAULT 0,
      discount_paise  INTEGER NOT NULL DEFAULT 0,
      tax_rate        INTEGER NOT NULL DEFAULT 0,
      tax_paise       INTEGER NOT NULL DEFAULT 0,
      amount_paise    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_snapshots (
      invoice_id      TEXT PRIMARY KEY REFERENCES invoices(id),
      template_json   TEXT NOT NULL,
      data_json       TEXT NOT NULL,
      rendered_html   TEXT,
      created_at      TEXT NOT NULL
    );
  `);

  // ── Domain 8: Payments ───────────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS payments (
      id            TEXT PRIMARY KEY,
      invoice_id    TEXT NOT NULL REFERENCES invoices(id),
      amount_paise  INTEGER NOT NULL,
      method        TEXT NOT NULL
                      CHECK (method IN ('cash','upi','card','bank_transfer','credit')),
      reference     TEXT,
      state         TEXT NOT NULL DEFAULT 'received'
                      CHECK (state IN ('received','refunded')),
      created_at    TEXT NOT NULL
    );
  `);

  // ── Domain 9: Expenses ───────────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id              TEXT PRIMARY KEY,
      business_id     TEXT NOT NULL REFERENCES businesses(id),
      category        TEXT NOT NULL,
      amount_paise    INTEGER NOT NULL,
      vendor          TEXT,
      notes           TEXT,
      receipt_path    TEXT,
      state           TEXT NOT NULL DEFAULT 'unpaid'
                        CHECK (state IN ('unpaid','paid','voided')),
      payment_method  TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
  `);

  // ── Domain 10: Reconciliation ────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reconciliation_tasks (
      id                TEXT PRIMARY KEY,
      business_id       TEXT NOT NULL REFERENCES businesses(id),
      conflict_type     TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','resolved','ignored')),
      affected_ids      TEXT NOT NULL,
      description       TEXT NOT NULL,
      resolution_hint   TEXT,
      resolution        TEXT,
      resolved_at       TEXT,
      resolved_by       TEXT REFERENCES workers(id),
      created_at        TEXT NOT NULL
    );
  `);

  // ── Domain 11: Ledger (append-only, no FK constraints) ──────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ledger_events (
      id            TEXT PRIMARY KEY,
      business_id   TEXT NOT NULL,
      device_id     TEXT NOT NULL,
      worker_id     TEXT NOT NULL,
      device_seq    INTEGER NOT NULL,
      cloud_seq     INTEGER,
      event_type    TEXT NOT NULL,
      entity_type   TEXT NOT NULL,
      entity_id     TEXT NOT NULL,
      payload       TEXT NOT NULL,
      occurred_at   TEXT NOT NULL,
      synced_at     TEXT,
      checksum      TEXT NOT NULL
    );
  `);

  // ── Indexes ──────────────────────────────────────────────────────────────

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_workers_business
      ON workers (business_id, active);

    CREATE INDEX IF NOT EXISTS idx_customers_business
      ON customers (business_id);
    CREATE INDEX IF NOT EXISTS idx_customers_phone
      ON customers (business_id, phone);

    CREATE INDEX IF NOT EXISTS idx_suppliers_business
      ON suppliers (business_id);

    CREATE INDEX IF NOT EXISTS idx_products_business
      ON products (business_id);
    CREATE INDEX IF NOT EXISTS idx_products_sku
      ON products (business_id, sku);

    CREATE INDEX IF NOT EXISTS idx_batches_product
      ON batches (product_id, qty_available);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry
      ON batches (business_id, expiry_date);

    CREATE INDEX IF NOT EXISTS idx_templates_business
      ON templates (business_id, state);

    CREATE INDEX IF NOT EXISTS idx_template_versions_template
      ON template_versions (template_id, version_no);

    CREATE INDEX IF NOT EXISTS idx_number_blocks_active
      ON number_blocks (business_id, entity_type, exhausted);

    CREATE INDEX IF NOT EXISTS idx_invoices_business
      ON invoices (business_id, state, issued_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer
      ON invoices (customer_id, state);
    CREATE INDEX IF NOT EXISTS idx_invoices_number
      ON invoices (business_id, number);
    CREATE INDEX IF NOT EXISTS idx_invoices_worker
      ON invoices (worker_id, issued_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_template_version
      ON invoices (template_version_id, state, issued_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_payment_state
      ON invoices (business_id, payment_state);

    CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice
      ON invoice_lines (invoice_id, line_no);
    CREATE INDEX IF NOT EXISTS idx_invoice_lines_product
      ON invoice_lines (product_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_lines_batch
      ON invoice_lines (batch_id);

    CREATE INDEX IF NOT EXISTS idx_payments_invoice
      ON payments (invoice_id);

    CREATE INDEX IF NOT EXISTS idx_expenses_business
      ON expenses (business_id, state, created_at);

    CREATE INDEX IF NOT EXISTS idx_reconciliation_business
      ON reconciliation_tasks (business_id, status);

    CREATE INDEX IF NOT EXISTS idx_ledger_entity
      ON ledger_events (entity_type, entity_id, device_seq);
    CREATE INDEX IF NOT EXISTS idx_ledger_device_seq
      ON ledger_events (device_id, device_seq);
    CREATE INDEX IF NOT EXISTS idx_ledger_time
      ON ledger_events (business_id, occurred_at);
  `);

  // Partial index for sync queue — only unsynced events
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_ledger_sync
      ON ledger_events (business_id, synced_at)
      WHERE synced_at IS NULL;
  `);

  // ── Record migration ─────────────────────────────────────────────────────

  await db.runAsync(
    `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
    [1, new Date().toISOString()]
  );
}
