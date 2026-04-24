import React, { useState } from 'react';
import { InwardItem, StorageLocation, CATEGORIES, UNITS, REFERENCE_ITEMS, CATEGORY_COLOURS, CustomItem } from '../types';
import { Plus, Trash2, ChevronUp, Snowflake, ThermometerSun } from 'lucide-react';

interface InwardsTabProps {
  inwards: InwardItem[];
  customItems: CustomItem[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  onAdd: (item: string, category: string, qty: number, unit: string, donor: string, bestBefore: string, storage: StorageLocation, enteredBy: string) => void;
  onDelete: (id: string) => void;
}

export const InwardsTab: React.FC<InwardsTabProps> = ({ inwards, customItems, storage, onStorageChange, onAdd, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [item, setItem] = useState('');
  const [category, setCategory] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState('items');
  const [donor, setDonor] = useState('');
  const [enteredBy, setEnteredBy] = useState('');
  const [bestBefore, setBestBefore] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'partial' | 'gone'>('all');

  // Merge built-in + custom items
  const allItems: Record<string, string> = { ...REFERENCE_ITEMS };
  customItems.forEach(ci => { allItems[ci.name] = ci.category; });
  const itemNames = Object.keys(allItems).sort();

  const handleItemChange = (val: string) => {
    setItem(val);
    if (allItems[val]) setCategory(allItems[val]);
  };

  const handleSubmit = () => {
    if (!item.trim() || qty <= 0) return;
    let formattedBB = bestBefore;
    if (bestBefore && bestBefore.includes('-')) {
      const [y, m, d] = bestBefore.split('-');
      formattedBB = `${d}/${m}/${y}`;
    }
    onAdd(item.trim(), category || 'Other', qty, unit, donor.trim(), formattedBB, storage, enteredBy.trim());
    setItem('');
    setCategory('');
    setQty(1);
    setUnit('items');
    setDonor('');
    setEnteredBy('');
    setBestBefore('');
    setShowForm(false);
  };

  const filtered = inwards
    .filter(i => i.storage === storage)
    .filter(i => {
      if (filterStatus !== 'all' && i.status !== filterStatus) return false;
      if (search && !i.item.toLowerCase().includes(search.toLowerCase()) && !i.id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

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
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? <ChevronUp size={16} /> : <Plus size={16} />}
        {showForm ? 'Close Form' : `Log Item Into ${isFridge ? 'Fridge' : 'Freezer'}`}
      </button>

      {/* Entry form */}
      {showForm && (
        <div className={`rounded-xl border-2 ${isFridge ? 'border-emerald-200 bg-emerald-50/50' : 'border-blue-200 bg-blue-50/50'}`}>
          <div className="p-4 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              {isFridge ? '🧊' : '❄️'} New {isFridge ? 'Fridge' : 'Freezer'} Entry
            </h3>

            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs font-medium">Item Name *</span></label>
              <input
                className="input input-bordered input-sm w-full bg-white"
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
              <label className="label py-0.5"><span className="label-text text-xs font-medium">Category</span></label>
              <select className="select select-bordered select-sm w-full bg-white" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Select...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="form-control flex-1">
                <label className="label py-0.5"><span className="label-text text-xs font-medium">Quantity *</span></label>
                <input type="number" className="input input-bordered input-sm w-full bg-white" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
              </div>
              <div className="form-control flex-1">
                <label className="label py-0.5"><span className="label-text text-xs font-medium">Unit</span></label>
                <select className="select select-bordered select-sm w-full bg-white" value={unit} onChange={e => setUnit(e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs font-medium">📥 From (Donor / Source)</span></label>
              <input className="input input-bordered input-sm w-full bg-white" placeholder="e.g. Tesco, Lidl, Co-op, Local Bakery, Public Donation..." value={donor} onChange={e => setDonor(e.target.value)} />
            </div>

            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs font-medium">✍️ Entered By (Initials)</span></label>
              <input className="input input-bordered input-sm w-full bg-white" placeholder="e.g. JD, SM, AB..." value={enteredBy} onChange={e => setEnteredBy(e.target.value)} />
            </div>

            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs font-medium">Best Before</span></label>
              <input type="date" className="input input-bordered input-sm w-full bg-white" value={bestBefore} onChange={e => setBestBefore(e.target.value)} />
            </div>

            <button
              className={`btn btn-sm w-full text-white ${isFridge ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600' : 'bg-blue-500 hover:bg-blue-600 border-blue-600'}`}
              onClick={handleSubmit}
              disabled={!item.trim() || qty <= 0}
            >
              <Plus size={16} /> Add to {isFridge ? 'Fridge' : 'Freezer'}
            </button>
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
          filtered.map(i => {
            const catColour = CATEGORY_COLOURS[i.category] || CATEGORY_COLOURS['Other'];
            const statusColour = i.status === 'available'
              ? 'border-l-emerald-500 bg-gradient-to-r from-emerald-50/50 to-transparent'
              : i.status === 'partial'
              ? 'border-l-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent'
              : 'border-l-red-500 bg-gradient-to-r from-red-50/50 to-transparent';

            return (
              <div key={i.id} className={`rounded-xl border border-base-300 border-l-4 ${statusColour} overflow-hidden`}>
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs bg-base-200 px-1.5 py-0.5 rounded">{i.id}</span>
                        <span className="font-bold text-sm">{i.item}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${catColour}`}>{i.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          i.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                          i.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {i.status === 'available' ? '● Available' : i.status === 'partial' ? '◐ Partial' : '○ Gone'}
                        </span>
                      </div>
                      <div className="text-xs text-base-content/60 space-y-0.5">
                        <div>{i.donor ? `From: ${i.donor}` : 'No donor'}{i.entered_by ? ` · ✍️ ${i.entered_by}` : ''} · {i.date_in} {i.time_in}</div>
                        {i.best_before && <div>📅 Best before: <span className="font-medium">{i.best_before}</span></div>}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-xs text-red-400 hover:text-red-600" onClick={() => onDelete(i.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Quantity bar */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-base-content/70">In: {i.qty_in} {i.unit}</span>
                      <span className="text-blue-600">Out: {i.total_taken}</span>
                      <span className="text-red-600">Waste: {i.total_wasted}</span>
                      <span className={`font-bold ${i.qty_remaining > 0 ? 'text-emerald-700' : 'text-red-700'}`}>Left: {i.qty_remaining}</span>
                    </div>
                    <div className="w-full bg-base-300 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          i.qty_remaining <= 0 ? 'bg-red-500' :
                          i.qty_remaining < i.qty_in ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(0, (i.qty_remaining / i.qty_in) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
