import { getDb } from '../database/db';
import { Customer } from '../types';
import { generateId, nowIso } from '../utils/id';

function rowToCustomer(row: any): Customer {
  return {
    id:               row.id,
    businessId:       row.business_id,
    name:             row.name,
    phone:            row.phone ?? undefined,
    email:            row.email ?? undefined,
    gstin:            row.gstin ?? undefined,
    address:          row.address ?? undefined,
    city:             row.city ?? undefined,
    stateName:        row.state_name ?? undefined,
    outstandingCredit: row.outstanding_credit,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

export async function getCustomers(businessId: string): Promise<Customer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM customers WHERE business_id = ? ORDER BY name ASC',
    [businessId]
  );
  return rows.map(rowToCustomer);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM customers WHERE id = ?', [id]);
  return row ? rowToCustomer(row) : null;
}

export async function createCustomer(
  businessId: string,
  data: { name: string; phone?: string; email?: string; gstin?: string; address?: string; city?: string; stateName?: string }
): Promise<Customer> {
  const db  = await getDb();
  const id  = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO customers
       (id, business_id, name, phone, email, gstin, address, city, state_name,
        outstanding_credit, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, businessId, data.name, data.phone ?? null, data.email ?? null,
     data.gstin ?? null, data.address ?? null, data.city ?? null,
     data.stateName ?? null, now, now]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM customers WHERE id = ?', [id]);
  return rowToCustomer(row!);
}

export async function updateCustomer(
  id: string,
  data: Partial<Omit<Customer, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const db = await getDb();
  const pairs: string[] = [];
  const vals: any[] = [];

  if (data.name             !== undefined) { pairs.push('name = ?');          vals.push(data.name); }
  if (data.phone            !== undefined) { pairs.push('phone = ?');         vals.push(data.phone); }
  if (data.email            !== undefined) { pairs.push('email = ?');         vals.push(data.email); }
  if (data.gstin            !== undefined) { pairs.push('gstin = ?');         vals.push(data.gstin); }
  if (data.address          !== undefined) { pairs.push('address = ?');       vals.push(data.address); }
  if (data.city             !== undefined) { pairs.push('city = ?');          vals.push(data.city); }
  if (data.stateName        !== undefined) { pairs.push('state_name = ?');    vals.push(data.stateName); }
  if (data.outstandingCredit!== undefined) { pairs.push('outstanding_credit = ?'); vals.push(data.outstandingCredit); }

  if (pairs.length === 0) return;
  pairs.push('updated_at = ?');
  vals.push(nowIso());
  vals.push(id);
  await db.runAsync(`UPDATE customers SET ${pairs.join(', ')} WHERE id = ?`, vals);
}

export async function findMatchingCustomer(
  businessId: string,
  criteria: { name?: string; phone?: string; gstin?: string }
): Promise<Customer | null> {
  const db = await getDb();
  const { name, phone, gstin } = criteria;

  if (phone?.trim()) {
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM customers WHERE business_id = ? AND phone = ? LIMIT 1',
      [businessId, phone.trim()]
    );
    if (row) return rowToCustomer(row);
  }
  if (gstin?.trim()) {
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM customers WHERE business_id = ? AND gstin = ? LIMIT 1',
      [businessId, gstin.trim()]
    );
    if (row) return rowToCustomer(row);
  }
  if (name?.trim()) {
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM customers WHERE business_id = ? AND LOWER(name) = LOWER(?) LIMIT 1',
      [businessId, name.trim()]
    );
    if (row) return rowToCustomer(row);
  }
  return null;
}

export async function searchCustomers(businessId: string, query: string): Promise<Customer[]> {
  const db = await getDb();
  const q = `%${query}%`;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM customers
     WHERE business_id = ? AND (name LIKE ? OR phone LIKE ?)
     ORDER BY name ASC LIMIT 30`,
    [businessId, q, q]
  );
  return rows.map(rowToCustomer);
}
