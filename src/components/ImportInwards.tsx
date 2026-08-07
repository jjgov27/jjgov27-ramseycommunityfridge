import React, { useState, useRef } from 'react';
import { StorageLocation, CATEGORIES } from '../types';
import { Upload, FileText, Download, X, Check } from 'lucide-react';
import { bulkAddCustomItems } from '../utils/db';

const tomorrowISO = () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

interface ImportItem {
  id: number;
  item: string;
  category: string;
  qty: number;
  unit: string;
  weight: number;
  value: number;          // total value for the line
  storage: StorageLocation;
  selected: boolean;
  bestBefore: string;     // per-item best before (YYYY-MM-DD for input[type=date])
  originalItem?: string;  // original imported name before fuzzy match
  matched?: boolean;      // true = fuzzy-matched to existing item
}

/* ---- Fuzzy matching helpers ---- */
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
};

const fuzzyMatch = (imported: string, existingItems: string[], threshold = 0.35): { name: string; matched: boolean } => {
  const lower = imported.toLowerCase().trim();
  // Exact match (case-insensitive)
  const exact = existingItems.find(e => e.toLowerCase() === lower);
  if (exact) return { name: exact, matched: true };
  // Contains match — existing item contains imported or vice versa
  const contains = existingItems.find(e =>
    e.toLowerCase().includes(lower) || lower.includes(e.toLowerCase())
  );
  if (contains) return { name: contains, matched: true };
  // Levenshtein distance — match if distance is within threshold of the longer string
  let bestMatch = '';
  let bestScore = Infinity;
  for (const e of existingItems) {
    const dist = levenshtein(lower, e.toLowerCase());
    const maxLen = Math.max(lower.length, e.length);
    const ratio = dist / maxLen;
    if (ratio < bestScore) { bestScore = ratio; bestMatch = e; }
  }
  if (bestScore <= threshold && bestMatch) return { name: bestMatch, matched: true };
  // No match — return capitalised original
  return { name: cap(imported), matched: false };
};

/* ---- Category mapping from Foodiverse/Tesco ---- */
const TESCO_CAT: Record<string, string> = {
  'fresh veg': 'Vegetables',
  'fresh fruit': 'Fruit',
  'fruit': 'Fruit',
  'vegetables': 'Vegetables',
  'bread and bread products': 'Bakery',
  'bakery': 'Bakery',
  'chilled products with dairy and eggs': 'Dairy',
  'chilled products': 'Dairy',
  'dairy': 'Dairy',
  'fresh meat': 'Meat',
  'meat': 'Meat',
  'other grocery': 'Other',
  'ambient': 'Other',
  'frozen': 'Frozen',
  'drinks': 'Drinks',
  'ready meals': 'Ready Meals',
  'snacks': 'Snacks',
  'condiments': 'Condiments',
};

const mapCategory = (src: string): string => {
  const lower = src.toLowerCase().trim();
  for (const [key, val] of Object.entries(TESCO_CAT)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return 'Other';
};

/* ---- Auto-capitalise ---- */
const cap = (s: string): string =>
  s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

/* ---- PDF.js CDN loader ---- */
const loadPdfJs = (): Promise<any> =>
  new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(lib);
    };
    s.onerror = () => reject(new Error('Could not load PDF parser'));
    document.head.appendChild(s);
  });

/* ---- Extract text from PDF ---- */
const extractPdfText = async (file: File): Promise<string> => {
  const lib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buf }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY = -1;
    for (const it of content.items as any[]) {
      if (lastY >= 0 && Math.abs(it.transform[5] - lastY) > 5) text += '\n';
      text += it.str + ' ';
      lastY = it.transform[5];
    }
    text += '\n\n';
  }
  return text;
};

/* ---- Parse Foodiverse email text into items ---- */
const parseTescoText = (raw: string): ImportItem[] => {
  const items: ImportItem[] = [];
  let id = 0;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Format 1 (email): "ProductName, SubCat  BARCODE  Category  QTY  WEIGHT Kg  GBP PRICE"
    // Match lines that contain a barcode (long number) followed by category, qty, weight, price
    const m1 = line.match(/^(.+?)\s+\d{6,}\s+(.+?)\s+(\d+)\s+([\d.]+)\s*Kg\s+GBP\s+([\d.]+)/i);
    if (m1) {
      // Clean product name: remove trailing ", SubCategory" like ", Fruit and Veg" or ", Bakery" or ", Chilled" etc.
      let name = m1[1].trim().replace(/,\s*(Fruit and Veg|Bakery|Chilled|Non Food|Frozen|Ambient)\s*$/i, '').trim();
      // Remove "Tesco " prefix for cleaner names (keep brand names like Warburtons)
      name = name.replace(/^Tesco\s+/i, '');
      items.push({
        id: id++, item: cap(name), category: mapCategory(m1[2].trim()),
        qty: parseInt(m1[3]), unit: 'items', weight: parseFloat(m1[4]),
        value: parseFloat(m1[5]), storage: 'fridge', selected: true, bestBefore: '',
      });
      continue;
    }

    // Format 2 (old PDF text): "Quantity: N Product: NAME Weight: X kg Value: £Y"
    const m2 = line.match(/Quantity:\s*(\d+)\s*Product:\s*(.+?)\s*Weight:\s*([\d.]+)\s*kg\s*Value:\s*£([\d.]+)/i);
    if (m2) {
      items.push({
        id: id++, item: cap(m2[2].trim()), category: 'Other',
        qty: parseInt(m2[1]), unit: 'items', weight: parseFloat(m2[3]),
        value: parseFloat(m2[4]), storage: 'fridge', selected: true, bestBefore: '',
      });
      continue;
    }
  }
  return items;
};

/* ---- Date helper ---- */
const todayISO = () => new Date().toISOString().split('T')[0];

/* ---- Extract collection date from PDF text ---- */
const extractCollectionDate = (raw: string): string => {
  const m = raw.match(/Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (!m) return todayISO();
  const [d, mo, y] = m[1].split('/');
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

/* ================================================================ */

interface Props {
  onBulkAdd: (items: Array<{
    item: string; category: string; qty: number; unit: string;
    donor: string; bestBefore: string; storage: StorageLocation;
    enteredBy: string; date: string; unitValue: number;
  }>) => Promise<number>;
  activeVolunteer: string;
  isFridge: boolean;
  donors: Array<{ id: number; name: string }>;
  itemNames: string[];
  itemCategories: Record<string, string>;  // name → category lookup from custom items
  onAddItem?: (name: string, category: string) => void;  // callback to update parent's custom items list
}

export const ImportInwards: React.FC<Props> = ({ onBulkAdd, activeVolunteer, isFridge, donors, itemNames, itemCategories, onAddItem }) => {
  /* Apply fuzzy matching to parsed items against existing item names.
     When matched, also pull through the correct category from the items list. */
  const applyFuzzyMatch = (parsed: ImportItem[]): ImportItem[] =>
    parsed.map(it => {
      if (!itemNames.length) return it;
      const { name, matched } = fuzzyMatch(it.item, itemNames);
      // originalItem stores the raw imported name when it differs (fuzzy-matched or new item)
      const changed = name.toLowerCase() !== it.item.toLowerCase().trim();
      // If matched to an existing item, use that item's saved category
      const category = matched && itemCategories[name] ? itemCategories[name] : it.category;
      return { ...it, item: name, category, originalItem: changed || !matched ? it.item : undefined, matched };
    });
  const [mode, setMode] = useState<'none' | 'preview' | 'paste' | 'tesco-info'>('none');
  const [items, setItems] = useState<ImportItem[]>([]);
  const [bestBefore, setBestBefore] = useState('');
  const [importDate, setImportDate] = useState(todayISO());
  const [donor, setDonor] = useState('');
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [result, setResult] = useState('');
  const [sourceType, setSourceType] = useState<'tesco' | 'csv'>('tesco');
  const pdfRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  /* ---- Tesco PDF handler ---- */
  const handleTescoPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); setError('');
    try {
      const text = await extractPdfText(file);
      const parsed = parseTescoText(text);
      if (parsed.length === 0) {
        setError('No items found — try pasting the text instead.');
        setMode('paste'); setParsing(false); return;
      }
      setItems(applyFuzzyMatch(parsed));
      setDonor('Tesco');
      setImportDate(extractCollectionDate(text));
      setSourceType('tesco');
      setMode('preview');
    } catch (err: any) {
      setError(err.message || 'PDF parse failed');
      setMode('paste');
    }
    setParsing(false);
    if (pdfRef.current) pdfRef.current.value = '';
  };

  /* ---- Paste fallback ---- */
  const handlePaste = () => {
    if (!pasteText.trim()) return;
    const parsed = parseTescoText(pasteText);
    if (parsed.length === 0) { setError('No items found in pasted text.'); return; }
    setItems(applyFuzzyMatch(parsed));
    setDonor('Tesco');
    setImportDate(extractCollectionDate(pasteText));
    setSourceType('tesco');
    setMode('preview');
    setError('');
  };

  /* ---- CSV handler ---- */
  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { setError('CSV needs a header row + data rows.'); return; }

    const hdr = lines[0].toLowerCase().split(',').map(h => h.trim());
    const iItem = hdr.indexOf('item');
    const iQty  = hdr.indexOf('qty');
    if (iItem < 0 || iQty < 0) { setError('CSV must have "Item" and "Qty" columns.'); return; }

    const iCat   = hdr.indexOf('category');
    const iUnit  = hdr.indexOf('unit');
    const iVal   = hdr.indexOf('value');
    const iDonor = hdr.indexOf('donor');
    const iSellBy = hdr.findIndex(h => h === 'sell by' || h === 'sellby' || h === 'best before' || h === 'bestbefore' || h === 'bb');

    // Helper: parse various date formats to YYYY-MM-DD for date input
    const parseDate = (s: string): string => {
      if (!s) return '';
      // DD/MM/YYYY or DD-MM-YYYY
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
      // YYYY-MM-DD already
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      // Try Date parse
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
      return '';
    };

    const parsed: ImportItem[] = [];
    let id = 0;
    for (let r = 1; r < lines.length; r++) {
      const cols = lines[r].split(',').map(c => c.trim());
      const name = cols[iItem]; const qty = parseInt(cols[iQty]);
      if (!name || isNaN(qty) || qty <= 0) continue;
      parsed.push({
        id: id++, item: cap(name),
        category: iCat >= 0 && cols[iCat] ? cols[iCat] : 'Meat',
        qty, unit: iUnit >= 0 && cols[iUnit] ? cols[iUnit] : 'packs',
        weight: 0,
        value: iVal >= 0 ? (parseFloat(cols[iVal]) || 0) : 0,
        storage: 'fridge', selected: true,
        bestBefore: (iSellBy >= 0 && cols[iSellBy]) ? parseDate(cols[iSellBy]) : tomorrowISO(),
      });
    }
    if (parsed.length === 0) { setError('No valid rows in CSV.'); return; }
    setItems(applyFuzzyMatch(parsed));
    setDonor(iDonor >= 0 && parsed.length > 0 ? '' : '');
    setSourceType('csv');
    setMode('preview');
    setError('');
    if (csvRef.current) csvRef.current.value = '';
  };

  /* ---- Download CSV template ---- */
  const downloadTemplate = () => {
    const tmrw = tomorrowISO().split('-').reverse().join('/'); // DD/MM/YYYY
    const csv = `Item,Qty,Sell By,Category,Unit,Value\nChicken Breast,5,${tmrw},Meat,packs,\nBeef Mince,3,${tmrw},Meat,packs,\nPork Sausages,4,${tmrw},Meat,packs,\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'import-template.csv'; a.click();
  };

  /* ---- Bulk controls ---- */
  const setAllStorage = (s: StorageLocation) => setItems(p => p.map(i => ({ ...i, storage: s })));
  const toggleStorage = (id: number) => setItems(p => p.map(i => i.id === id ? { ...i, storage: i.storage === 'fridge' ? 'freezer' : 'fridge' } : i));
  const toggleSelect  = (id: number) => setItems(p => p.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  const toggleAll     = () => { const all = items.every(i => i.selected); setItems(p => p.map(i => ({ ...i, selected: !all }))); };
  const removeItem    = (id: number) => setItems(p => p.filter(i => i.id !== id));
  const updateField   = (id: number, field: keyof ImportItem, value: any) => setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  /* ---- Confirm import ---- */
  const handleImport = async () => {
    const sel = items.filter(i => i.selected);
    if (sel.length === 0) return;
    setImporting(true);

    // Format best-before from ISO to DD/MM/YYYY
    let formattedBB = bestBefore;
    if (bestBefore && bestBefore.includes('-')) {
      const [y, m, d] = bestBefore.split('-');
      formattedBB = `${d}/${m}/${y}`;
    }
    // Format import date
    let formattedDate = importDate;
    if (importDate && importDate.includes('-')) {
      const [y, m, d] = importDate.split('-');
      formattedDate = `${d}/${m}/${y}`;
    }

    // Auto-create any new items not already in the custom items list
    const existingLower = new Set(itemNames.map(n => n.toLowerCase()));
    const newItems: Array<{ name: string; category: string }> = [];
    for (const it of sel) {
      const lower = it.item.toLowerCase().trim();
      if (lower && !existingLower.has(lower) && !newItems.some(n => n.name.toLowerCase() === lower)) {
        newItems.push({ name: cap(it.item), category: it.category || 'Other' });
      }
    }
    // Batch-create all new items in a single DB call
    if (newItems.length > 0) {
      await bulkAddCustomItems(newItems);
      // Single refresh after all created
      if (onAddItem) onAddItem(newItems[0].name, newItems[0].category);
    }

    const rows = sel.map(it => {
      // Per-item best-before takes priority, then global best-before
      let itemBB = it.bestBefore || '';
      if (itemBB && itemBB.includes('-')) {
        const [y2, m2, d2] = itemBB.split('-');
        itemBB = `${d2}/${m2}/${y2}`;
      }
      return {
        item: it.item,
        category: it.category,
        qty: it.qty,
        unit: it.unit,
        donor,
        bestBefore: itemBB || formattedBB,
        storage: it.storage,
        enteredBy: activeVolunteer,
        date: formattedDate,
        unitValue: it.qty > 0 && it.value > 0 ? +(it.value / it.qty).toFixed(2) : 0,
      };
    });

    const count = await onBulkAdd(rows);
    const newMsg = newItems.length > 0 ? ` | 🆕 ${newItems.length} new item${newItems.length > 1 ? 's' : ''} added to list` : '';
    setResult(`✅ Imported ${count} items!${newMsg}`);
    setImporting(false);
    setTimeout(() => { setMode('none'); setItems([]); setResult(''); setError(''); }, 2000);
  };

  const selectedCount = items.filter(i => i.selected).length;

  /* ====================== TESCO PASTE / INFO MODE ====================== */
  if (mode === 'paste' || mode === 'tesco-info') return (
    <div className="rounded-xl border-2 border-orange-200 bg-orange-50/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">📄 Tesco / Foodiverse Import</h3>
        <button className="btn btn-ghost btn-xs" onClick={() => { setMode('none'); setError(''); setPasteText(''); }}><X size={14} /></button>
      </div>
      {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {error}</div>}

      {/* Option 1: Paste from email */}
      <div className="bg-white rounded-lg p-3 space-y-2 border border-orange-200">
        <p className="text-xs font-semibold text-orange-700">✉️ Option 1 — Paste from Foodiverse email (fastest)</p>
        <p className="text-[11px] text-base-content/60">Open the Foodiverse email, select all the product rows, copy, and paste below:</p>
        <textarea
          className="textarea textarea-bordered w-full h-28 text-xs bg-white"
          placeholder={"Paste the product table from the Foodiverse email here…\n\nExample line:\nTesco Closed Cup Mushrooms 400G, Fruit and Veg  0000003478295  Fresh Veg  9  3.87 Kg  GBP 11.61"}
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
        />
        <button className="btn btn-sm btn-primary w-full" onClick={handlePaste} disabled={!pasteText.trim()}>
          Parse Email Text
        </button>
      </div>

      {/* Option 2: PDF via Tasklet */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-1 border border-gray-200">
        <p className="text-xs font-semibold text-gray-600">📎 Option 2 — Got a scanned PDF instead?</p>
        <p className="text-[11px] text-base-content/50">Drop it into your Tasklet chat — Tasklet will read it and create a CSV you can import via 📥 Quick CSV.</p>
      </div>
    </div>
  );

  /* ====================== PREVIEW MODE ====================== */
  if (mode === 'preview' && items.length > 0) return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">{sourceType === 'tesco' ? '📄 Tesco Import Preview' : '📥 CSV Import Preview'}</h3>
        <button className="btn btn-ghost btn-xs" onClick={() => { setMode('none'); setItems([]); setError(''); }}><X size={14} /> Cancel</button>
      </div>

      {result && <div className="text-sm font-bold text-emerald-700 bg-emerald-50 rounded-lg p-3 text-center">{result}</div>}

      {/* Batch settings row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="form-control">
          <label className="label py-0"><span className="label-text text-[11px] font-medium">📅 Date</span></label>
          <input type="date" className="input input-bordered input-xs w-full bg-white" value={importDate} onChange={e => setImportDate(e.target.value)} />
        </div>
        <div className="form-control">
          <label className="label py-0"><span className="label-text text-[11px] font-medium">📥 Donor</span></label>
          <input list="import-donor-list" className="input input-bordered input-xs w-full bg-white" value={donor} onChange={e => setDonor(e.target.value)} placeholder="Select or type donor" />
          <datalist id="import-donor-list">
            {donors.map(d => <option key={d.id} value={d.name} />)}
          </datalist>
        </div>
        <div className="form-control">
          <label className="label py-0"><span className="label-text text-[11px] font-medium">Best Before</span></label>
          <input type="date" className="input input-bordered input-xs w-full bg-white" value={bestBefore} onChange={e => setBestBefore(e.target.value)} />
        </div>
      </div>

      {/* Storage bulk controls */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-xs font-medium">Set all:</span>
        <button className="btn btn-xs bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200" onClick={() => setAllStorage('fridge')}>🧊 Fridge</button>
        <button className="btn btn-xs bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200" onClick={() => setAllStorage('freezer')}>❄️ Freezer</button>
        <div className="flex-1" />
        <label className="text-xs flex items-center gap-1 cursor-pointer">
          <input type="checkbox" className="checkbox checkbox-xs" checked={items.every(i => i.selected)} onChange={toggleAll} />
          Select all
        </label>
      </div>

      {/* Match summary */}
      {items.length > 0 && (() => {
        const fuzzyCount = items.filter(i => i.matched).length;
        const exact = items.filter(i => !i.originalItem && !i.matched).length;
        const newCount = items.filter(i => !i.matched && i.originalItem).length;
        return (fuzzyCount > 0 || newCount > 0) ? (
          <div className="text-xs flex gap-3 flex-wrap">
            {exact > 0 && <span>⬜ {exact} exact</span>}
            {fuzzyCount > 0 && <span className="text-green-600">✅ {fuzzyCount} fuzzy matched</span>}
            {newCount > 0 && <span className="text-blue-600">🆕 {newCount} new — will be created on import</span>}
          </div>
        ) : null;
      })()}

      {/* Items table */}
      <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg">
        <table className="table table-xs w-full">
          <thead className="sticky top-0 bg-blue-100 z-10">
            <tr>
              <th className="w-8">✓</th>
              <th>Item</th>
              <th className="w-14">Qty</th>
              <th className="w-24">Category</th>
              <th className="w-16">Value</th>
              <th className="w-28">Sell By</th>
              <th className="w-20">Storage</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className={!it.selected ? 'opacity-40' : ''}>
                <td><input type="checkbox" className="checkbox checkbox-xs" checked={it.selected} onChange={() => toggleSelect(it.id)} /></td>
                <td>
                  <div className="flex items-center gap-1">
                    <input list={`item-list-${it.id}`} className={`input input-bordered input-xs w-full ${it.matched ? 'bg-green-50 border-green-300' : it.originalItem ? 'bg-blue-50 border-blue-300' : 'bg-white'}`} value={it.item} onChange={e => updateField(it.id, 'item', e.target.value)} />
                    <datalist id={`item-list-${it.id}`}>
                      {itemNames.map(n => <option key={n} value={n} />)}
                    </datalist>
                    {it.matched && <span title={`Matched from "${it.originalItem}"`} className="text-green-600 text-xs">✅</span>}
                    {!it.matched && it.originalItem && <span title="New item — will be created on import" className="text-blue-600 text-xs">🆕</span>}
                  </div>
                </td>
                <td><input type="number" className="input input-bordered input-xs w-full bg-white" min={1} value={it.qty} onChange={e => updateField(it.id, 'qty', parseInt(e.target.value) || 1)} /></td>
                <td>
                  <select className="select select-bordered select-xs w-full bg-white" value={it.category} onChange={e => updateField(it.id, 'category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="text-xs text-right font-medium">£{it.value.toFixed(2)}</td>
                <td><input type="date" className="input input-bordered input-xs w-full bg-white" value={it.bestBefore} onChange={e => updateField(it.id, 'bestBefore', e.target.value)} /></td>
                <td>
                  <button className={`btn btn-xs w-full ${it.storage === 'fridge' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`} onClick={() => toggleStorage(it.id)}>
                    {it.storage === 'fridge' ? '🧊 Fridge' : '❄️ Freezer'}
                  </button>
                </td>
                <td><button className="btn btn-ghost btn-xs text-red-400" onClick={() => removeItem(it.id)}><X size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary + Import */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-base-content/60">
          {selectedCount}/{items.length} selected · Qty: {items.filter(i => i.selected).reduce((s, i) => s + i.qty, 0)} · £{items.filter(i => i.selected).reduce((s, i) => s + i.value, 0).toFixed(2)}
        </div>
        <button className="btn btn-sm btn-success gap-1" onClick={handleImport} disabled={selectedCount === 0 || importing}>
          {importing ? <><span className="loading loading-spinner loading-xs" /> Importing…</> : <><Check size={14} /> Import {selectedCount} Items</>}
        </button>
      </div>
    </div>
  );

  /* ====================== BUTTONS MODE (default) ====================== */
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={handleTescoPdf} />
        <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />

        <button className="btn btn-xs btn-outline border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400 flex-1 gap-1" onClick={() => setMode('tesco-info')}>
          <FileText size={14} /> 📄 Tesco PDF
        </button>

        <button className="btn btn-xs btn-outline border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400 flex-1 gap-1" onClick={() => csvRef.current?.click()}>
          <Upload size={14} /> 📥 Quick CSV
        </button>

        <button className="btn btn-xs btn-outline border-gray-300 text-gray-500 hover:bg-gray-50 gap-1" onClick={downloadTemplate} title="Download CSV template">
          <Download size={14} />
        </button>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {error} <button className="ml-2 underline" onClick={() => setError('')}>dismiss</button></div>}
    </div>
  );
};
