import React, { useState, useMemo } from 'react';
import { InwardItem, StorageLocation, CATEGORIES, UNITS, REFERENCE_ITEMS, CATEGORY_COLOURS, CustomItem, Volunteer, Donor } from '../types';
import { Plus, Trash2, ChevronUp, ChevronDown, Snowflake, ThermometerSun, ArrowRightLeft, Pencil, Check, X } from 'lucide-react';

const todayISO = () => new Date().toISOString().split('T')[0];

/* Reusable single-item card — used standalone and inside grouped entries */
const SingleItemCard: React.FC<{
  i: InwardItem; editingId: string | null; editItem: string; setEditItem: (v: string) => void;
  editCategory: string; setEditCategory: (v: string) => void; editQty: number; setEditQty: (v: number) => void;
  editDonor: string; setEditDonor: (v: string) => void; editBestBefore: string; setEditBestBefore: (v: string) => void;
  editEnteredBy: string; setEditEnteredBy: (v: string) => void; saveEdit: () => void;
  setEditingId: (id: string | null) => void; startEdit: (i: InwardItem) => void;
  onMove: (id: string, s: StorageLocation) => void; onDelete: (id: string) => void; compact?: boolean;
}> = ({ i, editingId, editItem, setEditItem, editCategory, setEditCategory, editQty, setEditQty, editDonor, setEditDonor, editBestBefore, setEditBestBefore, editEnteredBy, setEditEnteredBy, saveEdit, setEditingId, startEdit, onMove, onDelete, compact }) => {
  const catColour = CATEGORY_COLOURS[i.category] || CATEGORY_COLOURS['Other'];
  const statusColour = i.status === 'available'
    ? 'border-l-emerald-500 bg-gradient-to-r from-emerald-50/50 to-transparent'
    : i.status === 'partial'
    ? 'border-l-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent'
    : 'border-l-red-500 bg-gradient-to-r from-red-50/50 to-transparent';
  const moveTarget: StorageLocation = i.storage === 'fridge' ? 'freezer' : 'fridge';

  const inner = (
    <>
      {editingId === i.id ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs bg-base-200 px-1.5 py-0.5 rounded">{i.id}</span>
            <span className="text-xs font-bold text-blue-600">✏️ Editing</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-base-content/50 font-medium">Item Name</label>
              <input className="input input-bordered input-xs w-full" value={editItem} onChange={e => setEditItem(e.target.value)} /></div>
            <div><label className="text-[10px] text-base-content/50 font-medium">Category</label>
              <select className="select select-bordered select-xs w-full" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="text-[10px] text-base-content/50 font-medium">Quantity</label>
              <input type="number" className="input input-bordered input-xs w-full" min={1} value={editQty} onChange={e => setEditQty(Number(e.target.value))} /></div>
            <div><label className="text-[10px] text-base-content/50 font-medium">Donor</label>
              <input className="input input-bordered input-xs w-full" value={editDonor} onChange={e => setEditDonor(e.target.value)} /></div>
            <div><label className="text-[10px] text-base-content/50 font-medium">Best Before</label>
              <input className="input input-bordered input-xs w-full" value={editBestBefore} onChange={e => setEditBestBefore(e.target.value)} /></div>
            <div><label className="text-[10px] text-base-content/50 font-medium">Entered By</label>
              <input className="input input-bordered input-xs w-full" value={editEnteredBy} onChange={e => setEditEnteredBy(e.target.value)} /></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn btn-success btn-xs gap-1" onClick={saveEdit}><Check size={12} /> Save</button>
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => setEditingId(null)}><X size={12} /> Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs bg-base-200 px-1.5 py-0.5 rounded">{i.id}</span>
              <span className={`font-bold ${compact ? 'text-xs' : 'text-sm'}`}>{i.item}</span>
              {!compact && <span className={`text-xs px-2 py-0.5 rounded-full border ${catColour}`}>{i.category}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                i.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                i.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              }`}>
                {i.status === 'available' ? '● Available' : i.status === 'partial' ? '◐ Partial' : '○ Gone'}
              </span>
            </div>
            <div className="text-xs text-base-content/60 space-y-0.5">
              <div>{i.donor ? `From: ${i.donor}` : 'No donor'}{i.entered_by ? ` · ✍️ ${i.entered_by}` : ''} · {i.date_in} {i.time_in}</div>
              {i.unit_value > 0 && <div>💷 Value: <span className="font-medium text-emerald-700">£{i.unit_value.toFixed(2)} × {i.qty_in} = £{(i.unit_value * i.qty_in).toFixed(2)}</span></div>}
              {i.best_before && <div>📅 Best before: <span className="font-medium">{i.best_before}</span></div>}
              {i.moved_to && i.moved_date && (
                <div className="text-purple-600 font-medium">↪ Moved to {i.moved_to === 'fridge' ? '🧊 Fridge' : '❄️ Freezer'} on {i.moved_date}</div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button className="btn btn-ghost btn-xs text-blue-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => startEdit(i)} title="Edit"><Pencil size={14} /></button>
            {i.status !== 'gone' && (
              <button className="btn btn-ghost btn-xs text-purple-500 hover:text-purple-700 hover:bg-purple-50" onClick={() => onMove(i.id, moveTarget)} title={`Move to ${moveTarget}`}>
                <ArrowRightLeft size={14} /><span className="text-[10px]">{moveTarget === 'fridge' ? '🧊' : '❄️'}</span>
              </button>
            )}
            <button className="btn btn-ghost btn-xs text-red-400 hover:text-red-600" onClick={() => onDelete(i.id)}><Trash2 size={14} /></button>
          </div>
        </div>
      )}

      {/* Quantity bar */}
      <div className="mt-2">
        <div className="flex justify-between text-xs mb-1 font-medium">
          <span className="text-base-content/70">In: {i.qty_in} {i.unit}</span>
          <span className="text-blue-600">Out: {i.total_taken}</span>
          <span className="text-red-600">Waste: {i.total_wasted}</span>
          <span className={`font-bold ${i.qty_remaining > 0 ? 'text-emerald-700' : 'text-red-700'}`}>Left: {i.qty_remaining}</span>
        </div>
        <div className="w-full bg-base-300 rounded-full h-2.5 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${
            i.qty_remaining <= 0 ? 'bg-red-500' : i.qty_remaining < i.qty_in ? 'bg-amber-500' : 'bg-emerald-500'
          }`} style={{ width: `${Math.max(0, (i.qty_remaining / i.qty_in) * 100)}%` }} />
        </div>
      </div>
    </>
  );

  // When used inside a group (compact), don't wrap in outer card
  if (compact) return <div>{inner}</div>;

  return (
    <div className={`rounded-xl border border-base-300 border-l-4 ${statusColour} overflow-hidden`}>
      <div className="p-3">{inner}</div>
    </div>
  );
};

interface InwardsTabProps {
  inwards: InwardItem[];
  customItems: CustomItem[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  onAdd: (item: string, category: string, qty: number, unit: string, donor: string, bestBefore: string, storage: StorageLocation, enteredBy: string, overrideDate?: string, unitValue?: number) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, newStorage: StorageLocation) => void;
  onEdit: (id: string, fields: { item?: string; category?: string; qty_in?: number; donor?: string; best_before?: string; entered_by?: string }) => void;
  activeVolunteer: string;
  volunteers: Volunteer[];
  donors: Donor[];
}

export const InwardsTab: React.FC<InwardsTabProps> = ({ inwards, customItems, storage, onStorageChange, onAdd, onDelete, onMove, onEdit, activeVolunteer, volunteers, donors }) => {
  const [showForm, setShowForm] = useState(false);
  const [item, setItem] = useState('');
  const [category, setCategory] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState('items');
  const [donor, setDonor] = useState('');
  const [enteredBy, setEnteredBy] = useState(activeVolunteer);
  const [bestBefore, setBestBefore] = useState('');
  const [dateIn, setDateIn] = useState(todayISO());
  const [unitValue, setUnitValue] = useState(0);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editQty, setEditQty] = useState(1);
  const [editDonor, setEditDonor] = useState('');
  const [editBestBefore, setEditBestBefore] = useState('');
  const [editEnteredBy, setEditEnteredBy] = useState('');

  const startEdit = (i: InwardItem) => {
    setEditingId(i.id);
    setEditItem(i.item);
    setEditCategory(i.category);
    setEditQty(i.qty_in);
    setEditDonor(i.donor);
    setEditBestBefore(i.best_before);
    setEditEnteredBy(i.entered_by || '');
  };

  const saveEdit = () => {
    if (!editingId) return;
    onEdit(editingId, { item: editItem, category: editCategory, qty_in: editQty, donor: editDonor, best_before: editBestBefore, entered_by: editEnteredBy });
    setEditingId(null);
  };
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'partial' | 'gone'>('all');

  // Merge built-in + custom items
  const allItems: Record<string, string> = { ...REFERENCE_ITEMS };
  customItems.forEach(ci => { allItems[ci.name] = ci.category; });
  const itemNames = Object.keys(allItems).sort();

  const applyMeatDefaults = (cat: string) => {
    if (cat === 'Meat') {
      setUnit('packs');
      if (!donor) setDonor('W E Teare');
    }
  };

  const handleItemChange = (val: string) => {
    setItem(val);
    if (allItems[val]) {
      const cat = allItems[val];
      setCategory(cat);
      applyMeatDefaults(cat);
    }
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    applyMeatDefaults(cat);
  };

  const handleOpenForm = () => {
    if (!showForm) {
      setEnteredBy(activeVolunteer);
      setDateIn(todayISO());
    }
    setShowForm(!showForm);
  };

  const handleSubmit = () => {
    if (!item.trim() || qty <= 0) return;
    onAdd(item.trim(), category || 'Other', qty, unit, donor.trim(), bestBefore, storage, enteredBy.trim(), dateIn, unitValue || 0);
    setItem('');
    setCategory('');
    setQty(1);
    setUnit('items');
    setDonor('');
    setEnteredBy(activeVolunteer);
    setBestBefore('');
    setDateIn(todayISO());
    setUnitValue(0);
    setShowForm(false);
  };

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const statusOrder: Record<string, number> = { available: 0, partial: 1, gone: 2 };
  const filtered = inwards
    .filter(i => i.storage === storage)
    .filter(i => {
      if (filterStatus !== 'all' && i.status !== filterStatus) return false;
      if (search && !i.item.toLowerCase().includes(search.toLowerCase()) && !i.id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

  // Group consecutive same-item entries by item+date+donor+category
  const grouped = useMemo(() => {
    const groups: { key: string; items: InwardItem[] }[] = [];
    for (const item of filtered) {
      const key = `${item.item.toLowerCase()}|${item.date_in}|${(item.donor || '').toLowerCase()}|${item.category}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.items.push(item);
      } else {
        groups.push({ key, items: [item] });
      }
    }
    return groups;
  }, [filtered]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const isFridge = storage === 'fridge';

  return (
    <div className="space-y-3">
      {/* Storage toggle */}
      <div className="flex rounded-xl overflow-hidden border-2 border-base-300">
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-bold text-sm transition-all ${
            isFridge ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : 'bg-base-200 text-base-content/50'
          }`}
          onClick={() => onStorageChange('fridge')}
        >
          <ThermometerSun size={16} /> 🧊 Fridge
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-bold text-sm transition-all ${
            !isFridge ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-base-200 text-base-content/50'
          }`}
          onClick={() => onStorageChange('freezer')}
        >
          <Snowflake size={16} /> ❄️ Freezer
        </button>
      </div>

      {/* Add button */}
      <button
        className={`btn btn-sm w-full ${isFridge ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white' : 'bg-blue-500 hover:bg-blue-600 border-blue-600 text-white'}`}
        onClick={handleOpenForm}
      >
        {showForm ? <ChevronUp size={16} /> : <Plus size={16} />}
        {showForm ? 'Close Form' : `Log Item Into ${isFridge ? 'Fridge' : 'Freezer'}`}
      </button>

      {/* Entry form — compact 3-row grid, tab left→right then next row */}
      {showForm && (
        <div className={`rounded-xl border-2 ${isFridge ? 'border-emerald-200 bg-emerald-50/50' : 'border-blue-200 bg-blue-50/50'}`}>
          <div className="p-3 space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-1">
              {isFridge ? '🧊' : '❄️'} New {isFridge ? 'Fridge' : 'Freezer'} Entry
            </h3>

            {/* Row 1: Date — Item Name — Category */}
            <div className="grid grid-cols-3 gap-2">
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-[11px] font-medium">📅 Date Received</span></label>
                <input tabIndex={1} type="date" className="input input-bordered input-xs w-full bg-white" value={dateIn} onChange={e => setDateIn(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-[11px] font-medium">Item Name *</span></label>
                <input
                  tabIndex={2}
                  className="input input-bordered input-xs w-full bg-white"
                  list="item-list"
                  placeholder="Start typing or select..."
                  value={item}
                  onChange={e => handleItemChange(e.target.value)}
                />
                <datalist id="item-list">
                  {itemNames.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-[11px] font-medium">Category</span></label>
                <select tabIndex={3} className="select select-bordered select-xs w-full bg-white" value={category} onChange={e => handleCategoryChange(e.target.value)}>
                  <option value="">Select...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2: Qty — Unit — Donor — Value (£) — Best Before */}
            <div className="grid grid-cols-5 gap-2">
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-[11px] font-medium">Qty *</span></label>
                <input tabIndex={4} type="number" className="input input-bordered input-xs w-full bg-white" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-[11px] font-medium">Unit</span></label>
                <select tabIndex={5} className="select select-bordered select-xs w-full bg-white" value={unit} onChange={e => setUnit(e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-[11px] font-medium">📥 Donor</span></label>
                <input
                  tabIndex={6}
                  className="input input-bordered input-xs w-full bg-white"
                  list="donor-list"
                  placeholder="From (Donor / Source)"
                  value={donor}
                  onChange={e => setDonor(e.target.value)}
                />
                <datalist id="donor-list">
                  {donors.map(d => <option key={d.id} value={d.name} />)}
                </datalist>
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-[11px] font-medium">💷 Value (£)</span></label>
                <input tabIndex={7} type="number" className="input input-bordered input-xs w-full bg-white" min={0} step={0.01} placeholder="0.00" value={unitValue || ''} onChange={e => setUnitValue(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-[11px] font-medium">Best Before</span></label>
                <input tabIndex={8} type="date" className="input input-bordered input-xs w-full bg-white" value={bestBefore} onChange={e => setBestBefore(e.target.value)} />
              </div>
            </div>

            {/* Row 3: Entered By — Total Value display — Add button */}
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-[11px] font-medium">✍️ Entered By</span></label>
                <select
                  tabIndex={9}
                  className="select select-bordered select-xs bg-white w-full"
                  value={enteredBy}
                  onChange={e => setEnteredBy(e.target.value)}
                >
                  <option value="">Select volunteer...</option>
                  {volunteers.map(v => (
                    <option key={v.id} value={v.initials}>{v.initials} — {v.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                {unitValue > 0 && qty > 0 && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded px-2 py-1">
                    Total: £{(unitValue * qty).toFixed(2)}
                  </span>
                )}
              </div>
              <button
                tabIndex={10}
                className={`btn btn-xs text-white ${isFridge ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600' : 'bg-blue-500 hover:bg-blue-600 border-blue-600'}`}
                onClick={handleSubmit}
                disabled={!item.trim() || qty <= 0}
              >
                <Plus size={14} /> Add to {isFridge ? 'Fridge' : 'Freezer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <input className="input input-bordered input-sm flex-1" placeholder="Search items or ID..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select select-bordered select-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}>
          <option value="all">All</option>
          <option value="available">🟢 Available</option>
          <option value="partial">🟡 Partial</option>
          <option value="gone">🔴 Gone</option>
        </select>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-base-content/60 py-8 text-sm">
            {inwards.filter(i => i.storage === storage).length === 0
              ? `No items in ${storage} yet. Tap the button above to start!`
              : 'No items match your filter.'}
          </div>
        ) : (
          grouped.map(group => {
            // Single-item groups render normally (no grouping header)
            if (group.items.length === 1) {
              const i = group.items[0];
              return <SingleItemCard key={i.id} i={i} editingId={editingId} editItem={editItem} setEditItem={setEditItem} editCategory={editCategory} setEditCategory={setEditCategory} editQty={editQty} setEditQty={setEditQty} editDonor={editDonor} setEditDonor={setEditDonor} editBestBefore={editBestBefore} setEditBestBefore={setEditBestBefore} editEnteredBy={editEnteredBy} setEditEnteredBy={setEditEnteredBy} saveEdit={saveEdit} setEditingId={setEditingId} startEdit={startEdit} onMove={onMove} onDelete={onDelete} />;
            }

            // Multi-item group — consolidated card
            const totalQtyIn = group.items.reduce((s, i) => s + i.qty_in, 0);
            const totalTaken = group.items.reduce((s, i) => s + i.total_taken, 0);
            const totalWasted = group.items.reduce((s, i) => s + i.total_wasted, 0);
            const totalRemaining = group.items.reduce((s, i) => s + i.qty_remaining, 0);
            const totalValue = group.items.reduce((s, i) => s + (i.unit_value || 0) * i.qty_in, 0);
            const first = group.items[0];
            const catColour = CATEGORY_COLOURS[first.category] || CATEGORY_COLOURS['Other'];
            const isExpanded = expandedGroups.has(group.key);

            // Group status: available if any remaining, partial if some gone, gone if all gone
            const groupStatus = totalRemaining <= 0 ? 'gone' : totalRemaining < totalQtyIn ? 'partial' : 'available';
            const statusColour = groupStatus === 'available'
              ? 'border-l-emerald-500 bg-gradient-to-r from-emerald-50/50 to-transparent'
              : groupStatus === 'partial'
              ? 'border-l-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent'
              : 'border-l-red-500 bg-gradient-to-r from-red-50/50 to-transparent';

            return (
              <div key={group.key} className={`rounded-xl border border-base-300 border-l-4 ${statusColour} overflow-hidden`}>
                {/* Grouped summary header */}
                <div className="p-3 cursor-pointer" onClick={() => toggleGroup(group.key)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">×{group.items.length}</span>
                        <span className="font-bold text-sm">{first.item} × {totalQtyIn}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${catColour}`}>{first.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          groupStatus === 'available' ? 'bg-emerald-100 text-emerald-700' :
                          groupStatus === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {groupStatus === 'available' ? '● Available' : groupStatus === 'partial' ? '◐ Partial' : '○ Gone'}
                        </span>
                      </div>
                      <div className="text-xs text-base-content/60 space-y-0.5">
                        <div>{first.donor ? `From: ${first.donor}` : 'No donor'} · {first.date_in}</div>
                        {totalValue > 0 && <div>💷 Total Value: <span className="font-medium text-emerald-700">£{totalValue.toFixed(2)}</span></div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-base-content/40">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Combined quantity bar */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-base-content/70">In: {totalQtyIn} {first.unit}</span>
                      <span className="text-blue-600">Out: {totalTaken}</span>
                      <span className="text-red-600">Waste: {totalWasted}</span>
                      <span className={`font-bold ${totalRemaining > 0 ? 'text-emerald-700' : 'text-red-700'}`}>Left: {totalRemaining}</span>
                    </div>
                    <div className="w-full bg-base-300 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          totalRemaining <= 0 ? 'bg-red-500' :
                          totalRemaining < totalQtyIn ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(0, (totalRemaining / totalQtyIn) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded individual entries */}
                {isExpanded && (
                  <div className="border-t border-base-300 bg-base-100/50">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Individual Entries</div>
                    {group.items.map(i => (
                      <div key={i.id} className="border-t border-base-200 px-3 py-2">
                        <SingleItemCard i={i} editingId={editingId} editItem={editItem} setEditItem={setEditItem} editCategory={editCategory} setEditCategory={setEditCategory} editQty={editQty} setEditQty={setEditQty} editDonor={editDonor} setEditDonor={setEditDonor} editBestBefore={editBestBefore} setEditBestBefore={setEditBestBefore} editEnteredBy={editEnteredBy} setEditEnteredBy={setEditEnteredBy} saveEdit={saveEdit} setEditingId={setEditingId} startEdit={startEdit} onMove={onMove} onDelete={onDelete} compact />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
