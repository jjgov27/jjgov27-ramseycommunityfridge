import { sqlExec, sqlQuery } from './sql-adapter';
import { InwardItem, OutwardEntry, WastageEntry, CustomItem, StorageLocation, ArchivedRecord, Volunteer } from '../types';

const esc = (s: string) => s.replace(/'/g, "''");

// ========== INIT (reduced from 8 calls to 3) ==========

export async function initDB(): Promise<void> {
  // Core tables - one call each (SQLite requires separate CREATE TABLE statements)
  await Promise.all([
    sqlExec(`
      CREATE TABLE IF NOT EXISTS cf_inwards (
        id TEXT PRIMARY KEY,
        item TEXT NOT NULL,
        category TEXT NOT NULL,
        qty_in INTEGER NOT NULL,
        unit TEXT NOT NULL DEFAULT 'items',
        date_in TEXT NOT NULL,
        time_in TEXT NOT NULL,
        donor TEXT NOT NULL DEFAULT '',
        entered_by TEXT NOT NULL DEFAULT '',
        best_before TEXT NOT NULL DEFAULT '',
        storage TEXT NOT NULL DEFAULT 'fridge'
      )
    `),
    sqlExec(`
      CREATE TABLE IF NOT EXISTS cf_outwards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inward_id TEXT NOT NULL,
        qty_taken INTEGER NOT NULL DEFAULT 1,
        date_taken TEXT NOT NULL,
        time_taken TEXT NOT NULL,
        taken_by TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (inward_id) REFERENCES cf_inwards(id)
      )
    `),
    sqlExec(`
      CREATE TABLE IF NOT EXISTS cf_wastage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inward_id TEXT NOT NULL,
        qty_wasted INTEGER NOT NULL DEFAULT 1,
        reason TEXT NOT NULL DEFAULT 'Unknown',
        date_wasted TEXT NOT NULL,
        reported_by TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (inward_id) REFERENCES cf_inwards(id)
      )
    `),
    sqlExec(`
      CREATE TABLE IF NOT EXISTS cf_counter (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      )
    `),
    sqlExec(`
      CREATE TABLE IF NOT EXISTS cf_custom_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'Other'
      )
    `),
    sqlExec(`
      CREATE TABLE IF NOT EXISTS cf_volunteers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        initials TEXT NOT NULL UNIQUE
      )
    `),
    sqlExec(`
      CREATE TABLE IF NOT EXISTS cf_archive (
        id TEXT PRIMARY KEY,
        item TEXT NOT NULL,
        category TEXT NOT NULL,
        qty_in INTEGER NOT NULL,
        unit TEXT NOT NULL DEFAULT 'items',
        date_in TEXT NOT NULL,
        storage TEXT NOT NULL DEFAULT 'fridge',
        donor TEXT NOT NULL DEFAULT '',
        best_before TEXT NOT NULL DEFAULT '',
        total_taken INTEGER NOT NULL DEFAULT 0,
        total_wasted INTEGER NOT NULL DEFAULT 0,
        archived_date TEXT NOT NULL,
        outwards_json TEXT NOT NULL DEFAULT '[]',
        wastage_json TEXT NOT NULL DEFAULT '[]'
      )
    `),
  ]);

  // Seed counter
  await sqlExec(`INSERT OR IGNORE INTO cf_counter (key, value) VALUES ('next_id', 1)`);

  // Migrations - run in parallel, failures are expected
  await Promise.allSettled([
    sqlExec(`ALTER TABLE cf_inwards ADD COLUMN storage TEXT NOT NULL DEFAULT 'fridge'`),
    sqlExec(`ALTER TABLE cf_inwards ADD COLUMN entered_by TEXT NOT NULL DEFAULT ''`),
    sqlExec(`ALTER TABLE cf_wastage ADD COLUMN reported_by TEXT NOT NULL DEFAULT ''`),
  ]);
}

// ========== ID GENERATION ==========

async function getNextIdBatch(count: number): Promise<string[]> {
  const rows = await sqlQuery(`SELECT value FROM cf_counter WHERE key = 'next_id'`);
  const start = (rows[0]?.value as number) || 1;
  await sqlExec(`UPDATE cf_counter SET value = ${start + count} WHERE key = 'next_id'`);
  return Array.from({ length: count }, (_, i) => `CF-${String(start + i).padStart(3, '0')}`);
}

export async function getNextId(): Promise<string> {
  const [id] = await getNextIdBatch(1);
  return id;
}

// ========== INWARDS ==========

export async function addInward(
  item: string, category: string, qtyIn: number, unit: string,
  donor: string, bestBefore: string, storage: StorageLocation, enteredBy: string = ''
): Promise<string> {
  const id = await getNextId();
  const now = new Date();
  const dateIn = now.toLocaleDateString('en-GB');
  const timeIn = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  await sqlExec(`
    INSERT INTO cf_inwards (id, item, category, qty_in, unit, date_in, time_in, donor, entered_by, best_before, storage)
    VALUES ('${esc(id)}', '${esc(item)}', '${esc(category)}', ${qtyIn}, '${esc(unit)}', '${esc(dateIn)}', '${esc(timeIn)}', '${esc(donor)}', '${esc(enteredBy)}', '${esc(bestBefore)}', '${esc(storage)}')
  `);
  return id;
}

export async function loadInwards(): Promise<InwardItem[]> {
  const rows = await sqlQuery(`
    SELECT
      i.*,
      COALESCE((SELECT SUM(o.qty_taken) FROM cf_outwards o WHERE o.inward_id = i.id), 0) as total_taken,
      COALESCE((SELECT SUM(w.qty_wasted) FROM cf_wastage w WHERE w.inward_id = i.id), 0) as total_wasted
    FROM cf_inwards i
    ORDER BY i.id DESC
  `);

  return rows.map((r: Record<string, unknown>) => {
    const qtyIn = r.qty_in as number;
    const totalTaken = r.total_taken as number;
    const totalWasted = r.total_wasted as number;
    const remaining = qtyIn - totalTaken - totalWasted;
    let status: 'available' | 'partial' | 'gone' = 'available';
    if (remaining <= 0) status = 'gone';
    else if (totalTaken > 0 || totalWasted > 0) status = 'partial';

    return {
      id: r.id as string,
      item: r.item as string,
      category: r.category as string,
      qty_in: qtyIn,
      unit: r.unit as string,
      date_in: r.date_in as string,
      time_in: r.time_in as string,
      donor: r.donor as string,
      entered_by: (r.entered_by as string) || '',
      best_before: r.best_before as string,
      storage: (r.storage as StorageLocation) || 'fridge',
      total_taken: totalTaken,
      total_wasted: totalWasted,
      qty_remaining: remaining,
      status,
    };
  });
}

// ========== OUTWARDS ==========

export async function addOutward(inwardId: string, qtyTaken: number, takenBy: string): Promise<void> {
  const now = new Date();
  const dateTaken = now.toLocaleDateString('en-GB');
  const timeTaken = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  await sqlExec(`
    INSERT INTO cf_outwards (inward_id, qty_taken, date_taken, time_taken, taken_by)
    VALUES ('${esc(inwardId)}', ${qtyTaken}, '${esc(dateTaken)}', '${esc(timeTaken)}', '${esc(takenBy)}')
  `);
}

export async function loadOutwards(): Promise<OutwardEntry[]> {
  const rows = await sqlQuery(`
    SELECT o.*, COALESCE(i.item, o.inward_id) as item, COALESCE(i.category, 'Other') as category, COALESCE(i.storage, 'fridge') as storage
    FROM cf_outwards o
    LEFT JOIN cf_inwards i ON o.inward_id = i.id
    ORDER BY o.id DESC
  `);
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    inward_id: r.inward_id as string,
    item: r.item as string,
    category: r.category as string,
    storage: (r.storage as StorageLocation) || 'fridge',
    qty_taken: r.qty_taken as number,
    date_taken: r.date_taken as string,
    time_taken: r.time_taken as string,
    taken_by: r.taken_by as string,
  }));
}

// ========== WASTAGE ==========

export async function addWastage(inwardId: string, qtyWasted: number, reason: string, reportedBy: string, notes: string): Promise<void> {
  const now = new Date();
  const dateWasted = now.toLocaleDateString('en-GB');
  await sqlExec(`
    INSERT INTO cf_wastage (inward_id, qty_wasted, reason, date_wasted, reported_by, notes)
    VALUES ('${esc(inwardId)}', ${qtyWasted}, '${esc(reason)}', '${esc(dateWasted)}', '${esc(reportedBy)}', '${esc(notes)}')
  `);
}

export async function loadWastage(): Promise<WastageEntry[]> {
  const rows = await sqlQuery(`
    SELECT w.*, COALESCE(i.item, w.inward_id) as item, COALESCE(i.category, 'Other') as category, COALESCE(i.storage, 'fridge') as storage
    FROM cf_wastage w
    LEFT JOIN cf_inwards i ON w.inward_id = i.id
    ORDER BY w.id DESC
  `);
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    inward_id: r.inward_id as string,
    item: r.item as string,
    category: r.category as string,
    storage: (r.storage as StorageLocation) || 'fridge',
    qty_wasted: r.qty_wasted as number,
    reason: r.reason as string,
    date_wasted: r.date_wasted as string,
    reported_by: (r.reported_by as string) || '',
    notes: r.notes as string,
  }));
}

// ========== DELETE OPERATIONS ==========

export async function deleteOutward(id: number): Promise<void> {
  await sqlExec(`DELETE FROM cf_outwards WHERE id = ${id}`);
}

export async function deleteWastage(id: number): Promise<void> {
  await sqlExec(`DELETE FROM cf_wastage WHERE id = ${id}`);
}

export async function deleteInward(id: string): Promise<void> {
  // Batch deletes in parallel
  await Promise.all([
    sqlExec(`DELETE FROM cf_outwards WHERE inward_id = '${esc(id)}'`),
    sqlExec(`DELETE FROM cf_wastage WHERE inward_id = '${esc(id)}'`),
  ]);
  await sqlExec(`DELETE FROM cf_inwards WHERE id = '${esc(id)}'`);
}

// ========== CUSTOM ITEMS ==========

export async function loadCustomItems(): Promise<CustomItem[]> {
  const rows = await sqlQuery(`SELECT * FROM cf_custom_items ORDER BY name ASC`);
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    name: r.name as string,
    category: r.category as string,
  }));
}

const capitalise = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

export async function addCustomItem(name: string, category: string): Promise<void> {
  const capName = capitalise(name.trim());
  const capCat = capitalise(category.trim());
  await sqlExec(`INSERT OR IGNORE INTO cf_custom_items (name, category) VALUES ('${esc(capName)}', '${esc(capCat)}')`);
}

export async function deleteCustomItem(id: number): Promise<void> {
  await sqlExec(`DELETE FROM cf_custom_items WHERE id = ${id}`);
}

// Import custom items - BATCHED (1 call to delete + 1 call per 20 items)
export async function importCustomItems(csv: string): Promise<number> {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return 0;

  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('name') || firstLine.includes('item') || firstLine.includes('category');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const items: { name: string; category: string }[] = [];
  for (const line of dataLines) {
    const parts = line.match(/(\".*?\"|[^,]+)/g)?.map(p => p.replace(/^"|"$/g, '').trim()) || [];
    if (parts.length === 0 || !parts[0]) continue;
    items.push({ name: capitalise(parts[0]), category: parts[1] ? capitalise(parts[1]) : 'Other' });
  }

  if (items.length === 0) return 0;

  await sqlExec(`DELETE FROM cf_custom_items`);

  // Batch inserts - 20 items per call using INSERT SELECT UNION ALL
  const BATCH = 20;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const values = chunk.map(it => `SELECT '${esc(it.name)}', '${esc(it.category)}'`).join(' UNION ALL ');
    await sqlExec(`INSERT OR IGNORE INTO cf_custom_items (name, category) ${values}`);
  }

  return items.length;
}

// ========== VOLUNTEERS ==========

export async function loadVolunteers(): Promise<Volunteer[]> {
  const rows = await sqlQuery(`SELECT * FROM cf_volunteers ORDER BY name ASC`);
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    name: r.name as string,
    initials: r.initials as string,
  }));
}

export async function addVolunteer(name: string, initials: string): Promise<void> {
  const capName = capitalise(name.trim());
  const capInit = initials.trim().toUpperCase();
  if (!capName || !capInit) return;
  await sqlExec(`INSERT OR IGNORE INTO cf_volunteers (name, initials) VALUES ('${esc(capName)}', '${esc(capInit)}')`);
}

export async function deleteVolunteer(id: number): Promise<void> {
  await sqlExec(`DELETE FROM cf_volunteers WHERE id = ${id}`);
}

export async function importVolunteers(csv: string): Promise<number> {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return 0;

  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('name') || firstLine.includes('initial');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const items: { name: string; initials: string }[] = [];
  for (const line of dataLines) {
    const parts = line.match(/(\".*?\"|[^,]+)/g)?.map(p => p.replace(/^"|"$/g, '').trim()) || [];
    if (parts.length === 0 || !parts[0]) continue;
    items.push({
      name: capitalise(parts[0]),
      initials: parts[1] ? parts[1].toUpperCase() : parts[0].split(' ').map(w => w[0]).join('').toUpperCase(),
    });
  }

  if (items.length === 0) return 0;

  await sqlExec(`DELETE FROM cf_volunteers`);

  const BATCH = 20;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const values = chunk.map(it => `('${esc(it.name)}', '${esc(it.initials)}')`).join(',\n');
    await sqlExec(`INSERT OR IGNORE INTO cf_volunteers (name, initials) VALUES ${values}`);
  }

  return items.length;
}

// ========== ARCHIVE FUNCTIONS ==========

export async function archiveCompletedItems(): Promise<number> {
  // Find completed items
  const rows = await sqlQuery(`
    SELECT
      i.*,
      COALESCE((SELECT SUM(o.qty_taken) FROM cf_outwards o WHERE o.inward_id = i.id), 0) as total_taken,
      COALESCE((SELECT SUM(w.qty_wasted) FROM cf_wastage w WHERE w.inward_id = i.id), 0) as total_wasted
    FROM cf_inwards i
    WHERE (i.qty_in - COALESCE((SELECT SUM(o.qty_taken) FROM cf_outwards o WHERE o.inward_id = i.id), 0) - COALESCE((SELECT SUM(w.qty_wasted) FROM cf_wastage w WHERE w.inward_id = i.id), 0)) <= 0
  `);

  if (rows.length === 0) return 0;

  const now = new Date().toLocaleDateString('en-GB');
  const ids = rows.map(r => `'${esc(r.id as string)}'`).join(',');

  // Fetch all related outwards and wastage in 2 bulk queries instead of 2 per item
  const [allOut, allWast] = await Promise.all([
    sqlQuery(`SELECT * FROM cf_outwards WHERE inward_id IN (${ids})`),
    sqlQuery(`SELECT * FROM cf_wastage WHERE inward_id IN (${ids})`),
  ]);

  // Group by inward_id
  const outByItem: Record<string, unknown[]> = {};
  const wastByItem: Record<string, unknown[]> = {};
  for (const o of allOut) { const k = o.inward_id as string; (outByItem[k] ??= []).push(o); }
  for (const w of allWast) { const k = w.inward_id as string; (wastByItem[k] ??= []).push(w); }

  // Insert all archives in batches
  for (const r of rows) {
    const id = r.id as string;
    const outJson = JSON.stringify(outByItem[id] || []).replace(/'/g, "''");
    const wastJson = JSON.stringify(wastByItem[id] || []).replace(/'/g, "''");

    await sqlExec(`
      INSERT OR REPLACE INTO cf_archive (id, item, category, qty_in, unit, date_in, storage, donor, best_before, total_taken, total_wasted, archived_date, outwards_json, wastage_json)
      VALUES ('${esc(id)}', '${esc(r.item as string)}', '${esc(r.category as string)}', ${r.qty_in}, '${esc(r.unit as string)}', '${esc(r.date_in as string)}', '${esc((r.storage as string) || 'fridge')}', '${esc(r.donor as string)}', '${esc(r.best_before as string)}', ${r.total_taken}, ${r.total_wasted}, '${esc(now)}', '${outJson}', '${wastJson}')
    `);
  }

  // Bulk delete from live tables (3 calls instead of 3 per item)
  await Promise.all([
    sqlExec(`DELETE FROM cf_outwards WHERE inward_id IN (${ids})`),
    sqlExec(`DELETE FROM cf_wastage WHERE inward_id IN (${ids})`),
  ]);
  await sqlExec(`DELETE FROM cf_inwards WHERE id IN (${ids})`);

  return rows.length;
}

export async function loadArchive(): Promise<ArchivedRecord[]> {
  const rows = await sqlQuery(`SELECT * FROM cf_archive ORDER BY archived_date DESC, id DESC`);
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    item: r.item as string,
    category: r.category as string,
    qty_in: r.qty_in as number,
    unit: r.unit as string,
    date_in: r.date_in as string,
    storage: (r.storage as StorageLocation) || 'fridge',
    donor: r.donor as string,
    best_before: r.best_before as string,
    total_taken: r.total_taken as number,
    total_wasted: r.total_wasted as number,
    archived_date: r.archived_date as string,
    outwards_json: r.outwards_json as string,
    wastage_json: r.wastage_json as string,
  }));
}

export async function deleteArchiveItem(id: string): Promise<void> {
  await sqlExec(`DELETE FROM cf_archive WHERE id = '${esc(id)}'`);
}

// ========== CLEAR ALL (TEST MODE) ==========

export async function clearAllData(): Promise<void> {
  await Promise.all([
    sqlExec(`DELETE FROM cf_outwards`),
    sqlExec(`DELETE FROM cf_wastage`),
    sqlExec(`DELETE FROM cf_inwards`),
    sqlExec(`UPDATE cf_counter SET value = 1 WHERE key = 'next_id'`),
  ]);
}

export async function clearArchive(): Promise<void> {
  await sqlExec(`DELETE FROM cf_archive`);
}

export async function clearEverything(): Promise<void> {
  await Promise.all([
    sqlExec(`DELETE FROM cf_outwards`),
    sqlExec(`DELETE FROM cf_wastage`),
    sqlExec(`DELETE FROM cf_inwards`),
    sqlExec(`UPDATE cf_counter SET value = 1 WHERE key = 'next_id'`),
    sqlExec(`DELETE FROM cf_archive`),
    sqlExec(`DELETE FROM cf_custom_items`),
    sqlExec(`DELETE FROM cf_volunteers`),
  ]);
}

// ========== IMPORT FROM CSV (BATCHED) ==========

export async function importInwardsFromCSV(csvText: string): Promise<number> {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return 0;

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));

  const idIdx = header.findIndex(h => ['id','ref','reference'].includes(h));
  const itemIdx = header.findIndex(h => ['item','food item','name','food_item','description'].includes(h));
  const catIdx = header.findIndex(h => ['category','cat'].includes(h));
  const qtyIdx = header.findIndex(h => ['qty_in','qty','quantity','qty in','amount'].includes(h));
  const unitIdx = header.findIndex(h => ['unit','units'].includes(h));
  const dateIdx = header.findIndex(h => ['date_in','date','date in'].includes(h));
  const timeIdx = header.findIndex(h => ['time_in','time','time in'].includes(h));
  const donorIdx = header.findIndex(h => ['donor','donated by','from','donated_by','source'].includes(h));
  const enteredByIdx = header.findIndex(h => ['entered_by','entered by','initials','logged by','logged_by'].includes(h));
  const bbIdx = header.findIndex(h => ['best_before','best before','expiry','bb','use by','use_by','expiry date'].includes(h));
  const storIdx = header.findIndex(h => ['storage','location','stored in','stored_in','current location'].includes(h));

  if (itemIdx === -1) return 0;

  // Parse all rows first
  const parsed: { id: string | null; item: string; category: string; qty: number; unit: string; dateIn: string; timeIn: string; donor: string; enteredBy: string; bb: string; stor: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const item = cols[itemIdx];
    if (!item) continue;

    parsed.push({
      id: idIdx >= 0 && cols[idIdx] ? cols[idIdx] : null,
      item,
      category: catIdx >= 0 ? cols[catIdx] || 'Other' : 'Other',
      qty: qtyIdx >= 0 ? parseInt(cols[qtyIdx]) || 1 : 1,
      unit: unitIdx >= 0 ? cols[unitIdx] || 'items' : 'items',
      dateIn: dateIdx >= 0 ? cols[dateIdx] || new Date().toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
      timeIn: timeIdx >= 0 ? cols[timeIdx] || '00:00' : '00:00',
      donor: donorIdx >= 0 ? cols[donorIdx] || '' : '',
      enteredBy: enteredByIdx >= 0 ? cols[enteredByIdx] || '' : '',
      bb: bbIdx >= 0 ? cols[bbIdx] || '' : '',
      stor: storIdx >= 0 ? (cols[storIdx]?.toLowerCase() === 'freezer' ? 'freezer' : 'fridge') : 'fridge',
    });
  }

  if (parsed.length === 0) return 0;

  // Generate IDs in batch for items that need them
  const needIds = parsed.filter(p => !p.id).length;
  const generatedIds = needIds > 0 ? await getNextIdBatch(needIds) : [];
  let genIdx = 0;

  // Build batch inserts (10 per call to keep SQL size reasonable)
  const BATCH = 10;
  for (let i = 0; i < parsed.length; i += BATCH) {
    const chunk = parsed.slice(i, i + BATCH);
    const values = chunk.map(p => {
      const id = p.id || generatedIds[genIdx++];
      return `('${esc(id)}', '${esc(p.item)}', '${esc(p.category)}', ${p.qty}, '${esc(p.unit)}', '${esc(p.dateIn)}', '${esc(p.timeIn)}', '${esc(p.donor)}', '${esc(p.enteredBy)}', '${esc(p.bb)}', '${esc(p.stor)}')`;
    }).join(',\n');

    await sqlExec(`
      INSERT OR REPLACE INTO cf_inwards (id, item, category, qty_in, unit, date_in, time_in, donor, entered_by, best_before, storage)
      VALUES ${values}
    `);
  }

  return parsed.length;
}

export async function importOutwardsFromCSV(csvText: string): Promise<number> {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return 0;

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));

  const idIdx = header.findIndex(h => ['inward_id','inward id','id','item id','item_id','ref'].includes(h));
  const qtyIdx = header.findIndex(h => ['qty_taken','qty','quantity','qty taken','amount'].includes(h));
  const dateIdx = header.findIndex(h => ['date_taken','date','date taken','date out','date_out'].includes(h));
  const timeIdx = header.findIndex(h => ['time_taken','time','time taken','time out','time_out'].includes(h));
  const takenByIdx = header.findIndex(h => ['taken_by','taken by','to','collected by','collected_by','name','who'].includes(h));

  if (idIdx === -1) return 0;

  // Parse all rows
  const parsed: { inwardId: string; qty: number; dateTaken: string; timeTaken: string; takenBy: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const inwardId = cols[idIdx];
    if (!inwardId) continue;

    parsed.push({
      inwardId,
      qty: qtyIdx >= 0 ? parseInt(cols[qtyIdx]) || 1 : 1,
      dateTaken: dateIdx >= 0 ? cols[dateIdx] || new Date().toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
      timeTaken: timeIdx >= 0 ? cols[timeIdx] || '00:00' : '00:00',
      takenBy: takenByIdx >= 0 ? cols[takenByIdx] || '' : '',
    });
  }

  // Batch insert (10 per call)
  const BATCH = 10;
  for (let i = 0; i < parsed.length; i += BATCH) {
    const chunk = parsed.slice(i, i + BATCH);
    const values = chunk.map(p =>
      `('${esc(p.inwardId)}', ${p.qty}, '${esc(p.dateTaken)}', '${esc(p.timeTaken)}', '${esc(p.takenBy)}')`
    ).join(',\n');

    await sqlExec(`
      INSERT INTO cf_outwards (inward_id, qty_taken, date_taken, time_taken, taken_by)
      VALUES ${values}
    `);
  }

  return parsed.length;
}

export async function importWastageFromCSV(csvText: string): Promise<number> {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return 0;

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));

  const idIdx = header.findIndex(h => ['inward_id','inward id','id','item id','item_id','ref'].includes(h));
  const qtyIdx = header.findIndex(h => ['qty_wasted','qty','quantity','qty wasted','amount'].includes(h));
  const reasonIdx = header.findIndex(h => ['reason','cause','why'].includes(h));
  const dateIdx = header.findIndex(h => ['date_wasted','date','date wasted','date_out'].includes(h));
  const reportedIdx = header.findIndex(h => ['reported_by','reported by','by','who','name','volunteer'].includes(h));
  const notesIdx = header.findIndex(h => ['notes','note','comments','comment'].includes(h));

  if (idIdx === -1) return 0;

  const parsed: { inwardId: string; qty: number; reason: string; dateWasted: string; reportedBy: string; notes: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const inwardId = cols[idIdx];
    if (!inwardId) continue;

    parsed.push({
      inwardId,
      qty: qtyIdx >= 0 ? parseInt(cols[qtyIdx]) || 1 : 1,
      reason: reasonIdx >= 0 ? cols[reasonIdx] || 'Past Expiry' : 'Past Expiry',
      dateWasted: dateIdx >= 0 ? cols[dateIdx] || new Date().toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
      reportedBy: reportedIdx >= 0 ? cols[reportedIdx] || '' : '',
      notes: notesIdx >= 0 ? cols[notesIdx] || '' : '',
    });
  }

  // Batch insert (10 per call)
  const BATCH = 10;
  for (let i = 0; i < parsed.length; i += BATCH) {
    const chunk = parsed.slice(i, i + BATCH);
    const values = chunk.map(p =>
      `('${esc(p.inwardId)}', ${p.qty}, '${esc(p.reason)}', '${esc(p.dateWasted)}', '${esc(p.reportedBy)}', '${esc(p.notes)}')`
    ).join(',\n');

    await sqlExec(`
      INSERT INTO cf_wastage (inward_id, qty_wasted, reason, date_wasted, reported_by, notes)
      VALUES ${values}
    `);
  }

  return parsed.length;
}

// ========== EXPORT ARCHIVE TO CSV ==========

export function archiveToCSV(archive: ArchivedRecord[]): string {
  const headers = ['ID', 'Item', 'Category', 'Qty In', 'Unit', 'Date In', 'Storage', 'Donor', 'Best Before', 'Total Taken', 'Total Wasted', 'Archived Date'];
  const rows = archive.map(a => [
    a.id, a.item, a.category, a.qty_in, a.unit, a.date_in, a.storage, a.donor, a.best_before, a.total_taken, a.total_wasted, a.archived_date
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}
