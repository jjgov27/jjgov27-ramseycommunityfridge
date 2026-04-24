import React, { useState } from 'react';
import { InwardItem, OutwardEntry, StorageLocation, CATEGORY_COLOURS } from '../types';
import { Minus, Trash2, ChevronUp, Snowflake, ThermometerSun } from 'lucide-react';

interface OutwardsTabProps {
  inwards: InwardItem[];
  outwards: OutwardEntry[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  onTake: (inwardId: string, qty: number, takenBy: string) => void;
  onDelete: (id: number) => void;
}

export const OutwardsTab: React.FC<OutwardsTabProps> = ({ inwards, outwards, storage, onStorageChange, onTake, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [qtyTaken, setQtyTaken] = useState(1);
  const [takenBy, setTakenBy] = useState('');

  const availableItems = inwards.filter(i => i.storage === storage && i.qty_remaining > 0);
  const selectedItem = inwards.find(i => i.id === selectedId);
  const filteredOutwards = outwards.filter(o => o.storage === storage);
  const isFridge = storage === 'fridge';

  const handleSubmit = () => {
    if (!selectedId || qtyTaken <= 0) return;
    onTake(selectedId, qtyTaken, takenBy.trim());
    setQtyTaken(1);
    setTakenBy('');
  };

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

      {/* Record take button */}
      <button
        className={`btn btn-sm w-full text-white ${isFridge ? 'bg-orange-500 hover:bg-orange-600 border-orange-600' : 'bg-indigo-500 hover:bg-indigo-600 border-indigo-600'}`}
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? <ChevronUp size={16} /> : <Minus size={16} />}
        {showForm ? 'Close Form' : `Record Item Taken from ${isFridge ? 'Fridge' : 'Freezer'}`}
      </button>

      {/* Entry form */}
      {showForm && (
        <div className={`rounded-xl border-2 ${isFridge ? 'border-orange-200 bg-orange-50/50' : 'border-indigo-200 bg-indigo-50/50'}`}>
          <div className="p-4 space-y-3">
            <h3 className="font-bold text-sm">📤 Record Outward</h3>

            {availableItems.length === 0 ? (
              <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-sm text-sky-700">
                No items available in {storage}. Log items in the In tab first.
              </div>
            ) : (
              <>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">Select Item *</span></label>
                  <select
                    className="select select-bordered select-sm w-full bg-white"
                    value={selectedId}
                    onChange={e => { setSelectedId(e.target.value); setQtyTaken(1); }}
                  >
                    <option value="">Choose an item...</option>
                    {availableItems.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.id} — {i.item} ({i.qty_remaining} {i.unit} left)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedItem && (
                  <div className="rounded-lg bg-white border border-base-300 p-2">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <span className="font-medium">{selectedItem.item}</span>
                        <span className={`px-1.5 py-0.5 rounded-full border text-xs ${CATEGORY_COLOURS[selectedItem.category] || CATEGORY_COLOURS['Other']}`}>
                          {selectedItem.category}
                        </span>
                      </span>
                      <span className="font-bold text-emerald-700">{selectedItem.qty_remaining} {selectedItem.unit} left</span>
                    </div>
                    {selectedItem.donor && <div className="text-xs text-base-content/50 mt-0.5">From: {selectedItem.donor}</div>}
                  </div>
                )}

                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">Quantity Taken *</span></label>
                  <input type="number" className="input input-bordered input-sm w-full bg-white" min={1} max={selectedItem?.qty_remaining || 999} value={qtyTaken} onChange={e => setQtyTaken(parseInt(e.target.value) || 1)} />
                </div>

                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">📤 To (Collected By)</span></label>
                  <input className="input input-bordered input-sm w-full bg-white" placeholder="e.g. Community Member, Family, John, Foodbank..." value={takenBy} onChange={e => setTakenBy(e.target.value)} />
                </div>

                {/* Quick-take buttons */}
                {selectedItem && selectedItem.qty_remaining > 1 && (
                  <div className="flex gap-1 flex-wrap">
                    <span className="text-xs text-base-content/50 self-center mr-1">Quick:</span>
                    {[1, 2, 3, 5].filter(n => n <= selectedItem.qty_remaining).map(n => (
                      <button key={n} className={`btn btn-xs ${qtyTaken === n ? (isFridge ? 'bg-orange-500 text-white border-orange-600' : 'bg-indigo-500 text-white border-indigo-600') : 'btn-ghost'}`} onClick={() => setQtyTaken(n)}>{n}</button>
                    ))}
                    <button className={`btn btn-xs ${qtyTaken === selectedItem.qty_remaining ? (isFridge ? 'bg-orange-500 text-white border-orange-600' : 'bg-indigo-500 text-white border-indigo-600') : 'btn-ghost'}`} onClick={() => setQtyTaken(selectedItem.qty_remaining)}>
                      All ({selectedItem.qty_remaining})
                    </button>
                  </div>
                )}

                <button
                  className={`btn btn-sm w-full text-white ${isFridge ? 'bg-orange-500 hover:bg-orange-600 border-orange-600' : 'bg-indigo-500 hover:bg-indigo-600 border-indigo-600'}`}
                  onClick={handleSubmit}
                  disabled={!selectedId || qtyTaken <= 0}
                >
                  <Minus size={16} /> Record Take
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Log */}
      <div className="space-y-2">
        {filteredOutwards.length === 0 ? (
          <div className="text-center text-base-content/60 py-8 text-sm">
            No items taken from {storage} yet.
          </div>
        ) : (
          filteredOutwards.map(o => {
            const catColour = CATEGORY_COLOURS[o.category] || CATEGORY_COLOURS['Other'];
            return (
              <div key={o.id} className="rounded-xl border border-base-300 border-l-4 border-l-blue-400 bg-gradient-to-r from-blue-50/30 to-transparent overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-mono text-xs bg-base-200 px-1.5 py-0.5 rounded">{o.inward_id}</span>
                        <span className="font-bold text-sm">{o.item}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${catColour}`}>{o.category}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{o.qty_taken} taken</span>
                      </div>
                      <div className="text-xs text-base-content/60">
                        {o.date_taken} at {o.time_taken}
                        {o.taken_by && ` · by ${o.taken_by}`}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-xs text-red-400 hover:text-red-600" onClick={() => onDelete(o.id)}>
                      <Trash2 size={14} />
                    </button>
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
