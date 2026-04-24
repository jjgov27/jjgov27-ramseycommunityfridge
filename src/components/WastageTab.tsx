import React, { useState } from 'react';
import { InwardItem, WastageEntry, StorageLocation, WASTAGE_REASONS, CATEGORY_COLOURS } from '../types';
import { Trash2, ChevronUp, Snowflake, ThermometerSun } from 'lucide-react';

interface WastageTabProps {
  inwards: InwardItem[];
  wastage: WastageEntry[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  onAdd: (inwardId: string, qty: number, reason: string, reportedBy: string, notes: string) => void;
  onDelete: (id: number) => void;
}

export const WastageTab: React.FC<WastageTabProps> = ({ inwards, wastage, storage, onStorageChange, onAdd, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [qtyWasted, setQtyWasted] = useState(1);
  const [reason, setReason] = useState('Past Expiry');
  const [reportedBy, setReportedBy] = useState('');
  const [notes, setNotes] = useState('');

  const availableItems = inwards.filter(i => i.storage === storage && i.qty_remaining > 0);
  const selectedItem = inwards.find(i => i.id === selectedId);
  const filteredWastage = wastage.filter(w => w.storage === storage);
  const isFridge = storage === 'fridge';

  const handleSubmit = () => {
    if (!selectedId || qtyWasted <= 0) return;
    onAdd(selectedId, qtyWasted, reason, reportedBy.trim(), notes.trim());
    setSelectedId('');
    setQtyWasted(1);
    setReason('Past Expiry');
    setReportedBy('');
    setNotes('');
    setShowForm(false);
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

      {/* Log wastage button */}
      <button
        className="btn btn-sm w-full bg-red-500 hover:bg-red-600 border-red-600 text-white"
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? <ChevronUp size={16} /> : <Trash2 size={16} />}
        {showForm ? 'Close Form' : 'Log Wastage'}
      </button>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50/50">
          <div className="p-4 space-y-3">
            <h3 className="font-bold text-sm">🗑️ Record Wastage</h3>

            {availableItems.length === 0 ? (
              <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-sm text-sky-700">
                No items available to record wastage against.
              </div>
            ) : (
              <>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">Select Item *</span></label>
                  <select className="select select-bordered select-sm w-full bg-white" value={selectedId} onChange={e => { setSelectedId(e.target.value); setQtyWasted(1); }}>
                    <option value="">Choose an item...</option>
                    {availableItems.map(i => (
                      <option key={i.id} value={i.id}>{i.id} — {i.item} ({i.qty_remaining} {i.unit} left)</option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">Quantity Wasted *</span></label>
                  <input type="number" className="input input-bordered input-sm w-full bg-white" min={1} max={selectedItem?.qty_remaining || 999} value={qtyWasted} onChange={e => setQtyWasted(parseInt(e.target.value) || 1)} />
                </div>

                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">Reason *</span></label>
                  <select className="select select-bordered select-sm w-full bg-white" value={reason} onChange={e => setReason(e.target.value)}>
                    {WASTAGE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">🗑️ Reported By</span></label>
                  <input className="input input-bordered input-sm w-full bg-white" placeholder="e.g. Volunteer Name, Staff Member..." value={reportedBy} onChange={e => setReportedBy(e.target.value)} />
                </div>

                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">Notes (optional)</span></label>
                  <textarea className="textarea textarea-bordered textarea-sm w-full bg-white" placeholder="Any additional details..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>

                <button className="btn btn-sm w-full bg-red-500 hover:bg-red-600 border-red-600 text-white" onClick={handleSubmit} disabled={!selectedId || qtyWasted <= 0}>
                  <Trash2 size={16} /> Record Wastage
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Wastage log */}
      <div className="space-y-2">
        {filteredWastage.length === 0 ? (
          <div className="text-center text-base-content/60 py-8 text-sm">
            No wastage recorded for {storage}. That's great news! 🎉
          </div>
        ) : (
          filteredWastage.map(w => {
            const catColour = CATEGORY_COLOURS[w.category] || CATEGORY_COLOURS['Other'];
            return (
              <div key={w.id} className="rounded-xl border border-base-300 border-l-4 border-l-red-400 bg-gradient-to-r from-red-50/30 to-transparent overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-mono text-xs bg-base-200 px-1.5 py-0.5 rounded">{w.inward_id}</span>
                        <span className="font-bold text-sm">{w.item}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${catColour}`}>{w.category}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{w.qty_wasted} wasted</span>
                      </div>
                      <div className="text-xs text-base-content/60">
                        {w.reason} · {w.date_wasted}
                        {w.reported_by && ` · By: ${w.reported_by}`}
                        {w.notes && ` · ${w.notes}`}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-xs text-red-400 hover:text-red-600" onClick={() => onDelete(w.id)}>
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
