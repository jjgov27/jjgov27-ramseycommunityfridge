import React, { useState, useRef, useEffect } from 'react';
import { InwardItem, OutwardEntry, StorageLocation, CATEGORY_COLOURS, Volunteer } from '../types';
import { Minus, Trash2, ChevronUp, Snowflake, ThermometerSun, CheckCheck, Pencil, Check, X } from 'lucide-react';

const todayISO = () => new Date().toISOString().split('T')[0];

interface OutwardsTabProps {
  inwards: InwardItem[];
  outwards: OutwardEntry[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  onTake: (inwardId: string, qty: number, takenBy: string, recordedBy: string, overrideDate?: string) => void;
  onTakeAll: (storage: StorageLocation, takenBy: string, recordedBy: string, dateOverride?: string) => Promise<number>;
  onDelete: (id: number) => void;
  onEdit: (id: number, fields: { qty_taken?: number; taken_by?: string; recorded_by?: string }) => void;
  activeVolunteer: string;
  volunteers: Volunteer[];
}

export const OutwardsTab: React.FC<OutwardsTabProps> = ({ inwards, outwards, storage, onStorageChange, onTake, onTakeAll, onDelete, onEdit, activeVolunteer, volunteers }) => {
  const [showForm, setShowForm] = useState(false);
  const [showTakeAll, setShowTakeAll] = useState(false);
  const [editingOutId, setEditingOutId] = useState<number | null>(null);
  const [editOutQty, setEditOutQty] = useState(1);
  const [editOutTakenBy, setEditOutTakenBy] = useState('');
  const [editOutRecBy, setEditOutRecBy] = useState('');

  const startEditOut = (o: OutwardEntry) => {
    setEditingOutId(o.id);
    setEditOutQty(o.qty_taken);
    setEditOutTakenBy(o.taken_by || '');
    setEditOutRecBy(o.recorded_by || '');
  };

  const saveEditOut = () => {
    if (editingOutId === null) return;
    onEdit(editingOutId, { qty_taken: editOutQty, taken_by: editOutTakenBy, recorded_by: editOutRecBy });
    setEditingOutId(null);
  };
  const [takeAllBy, setTakeAllBy] = useState('');
  const [takeAllRecBy, setTakeAllRecBy] = useState(activeVolunteer);
  const [takeAllDate, setTakeAllDate] = useState(todayISO());
  const [takeAllConfirm, setTakeAllConfirm] = useState(false);
  const [takeAllBusy, setTakeAllBusy] = useState(false);
  const [takeAllDone, setTakeAllDone] = useState('');
  const [takeAllError, setTakeAllError] = useState('');
  const takeAllTimer = useRef<any>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState('');
  const [qtyTaken, setQtyTaken] = useState(1);
  const [takenBy, setTakenBy] = useState('');
  const [recordedBy, setRecordedBy] = useState(activeVolunteer);
  const [dateOut, setDateOut] = useState(todayISO());

  const availableItems = inwards.filter(i => i.storage === storage && i.qty_remaining > 0);
  const selectedItem = inwards.find(i => i.id === selectedId);
  const inwardStatusMap = new Map(inwards.map(i => [i.id, i.status]));
  const statusOrder: Record<string, number> = { available: 0, partial: 1, gone: 2 };
  const filteredOutwards = outwards
    .filter(o => o.storage === storage)
    .sort((a, b) => {
      const sa = statusOrder[(inwardStatusMap.get(a.inward_id) || 'gone') as string] ?? 3;
      const sb = statusOrder[(inwardStatusMap.get(b.inward_id) || 'gone') as string] ?? 3;
      return sa - sb;
    });
  const isFridge = storage === 'fridge';

  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = availableItems.length > 0 && availableItems.every(i => selectedItems.has(i.id));
      const noneSelected = availableItems.every(i => !selectedItems.has(i.id));
      selectAllRef.current.indeterminate = !allSelected && !noneSelected;
    }
  }, [selectedItems, availableItems]);

  const toggleSelectAll = () => {
    const allSelected = availableItems.length > 0 && availableItems.every(i => selectedItems.has(i.id));
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(availableItems.map(i => i.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenForm = () => {
    if (!showForm) {
      setRecordedBy(activeVolunteer);
      setDateOut(todayISO());
    }
    setShowForm(!showForm);
  };

  const handleSubmit = () => {
    if (!selectedId || qtyTaken <= 0) return;
    onTake(selectedId, qtyTaken, takenBy.trim(), recordedBy.trim(), dateOut);
    setQtyTaken(1);
    setTakenBy('');
    setRecordedBy(activeVolunteer);
    setDateOut(todayISO());
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

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          className={`btn btn-sm flex-1 text-white ${isFridge ? 'bg-orange-500 hover:bg-orange-600 border-orange-600' : 'bg-indigo-500 hover:bg-indigo-600 border-indigo-600'}`}
          onClick={handleOpenForm}
        >
          {showForm ? <ChevronUp size={16} /> : <Minus size={16} />}
          {showForm ? 'Close' : 'Record Single Take'}
        </button>
        <button
          className={`btn btn-sm text-white ${availableItems.length === 0 ? 'btn-disabled' : isFridge ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700' : 'bg-cyan-600 hover:bg-cyan-700 border-cyan-700'}`}
          onClick={() => {
            const opening = !showTakeAll;
            setShowTakeAll(opening);
            setShowForm(false);
            setTakeAllConfirm(false);
            setTakeAllDone('');
            setTakeAllError('');
            setTakeAllRecBy(activeVolunteer);
            setTakeAllDate(todayISO());
            if (opening) {
              setSelectedItems(new Set(availableItems.map(i => i.id)));
            }
          }}
        >
          <CheckCheck size={16} />
          {showTakeAll ? 'Close' : `Batch Take (${availableItems.length})`}
        </button>
      </div>

      {/* Take All panel */}
      {showTakeAll && (availableItems.length > 0 || takeAllDone || takeAllError) && (
        <div className={`rounded-xl border-2 ${isFridge ? 'border-emerald-200 bg-emerald-50/50' : 'border-cyan-200 bg-cyan-50/50'}`}>
          <div className="p-4 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <CheckCheck size={16} /> ⚡ Batch Take — {isFridge ? 'Fridge' : 'Freezer'}
            </h3>
            <div className="rounded-lg bg-white border border-base-300 p-3 text-sm">
              <label className="flex items-center gap-2 pb-2 mb-2 border-b border-base-300 cursor-pointer select-none">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={availableItems.length > 0 && availableItems.every(i => selectedItems.has(i.id))}
                  onChange={toggleSelectAll}
                />
                <span className="font-medium">Select All</span>
                <span className="ml-auto text-xs text-base-content/60">
                  {selectedItems.size} of {availableItems.length} items selected
                </span>
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {availableItems.map(i => (
                  <label key={i.id} className="flex items-center justify-between text-xs py-0.5 border-b border-base-200 last:border-0 cursor-pointer select-none">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={selectedItems.has(i.id)}
                        onChange={() => toggleSelectItem(i.id)}
                      />
                      <span className="font-mono bg-base-200 px-1 rounded">{i.id}</span>
                      <span>{i.item}</span>
                    </span>
                    <span className="font-bold text-emerald-700">{i.qty_remaining} {i.unit}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-base-300 flex justify-between font-bold text-sm">
                <span>Selected:</span>
                <span className="text-emerald-700">
                  {availableItems.filter(i => selectedItems.has(i.id)).reduce((s, i) => s + i.qty_remaining, 0)} units across {selectedItems.size} items
                </span>
              </div>
            </div>

            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs font-medium">📅 Date</span></label>
              <input type="date" className="input input-bordered input-sm w-full bg-white" value={takeAllDate} onChange={e => setTakeAllDate(e.target.value)} />
            </div>

            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs font-medium">📤 To (Collected By)</span></label>
              <input className="input input-bordered input-sm w-full bg-white" placeholder="e.g. Community Member, Family, Foodbank..." value={takeAllBy} onChange={e => setTakeAllBy(e.target.value)} />
            </div>

            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs font-medium">✍️ Recorded By (Volunteer)</span></label>
              <div className="flex gap-2">
                <select className="select select-bordered select-sm bg-white flex-1" value={takeAllRecBy} onChange={e => setTakeAllRecBy(e.target.value)}>
                  <option value="">Select volunteer...</option>
                  {volunteers.map(v => (<option key={v.id} value={v.initials}>{v.initials} — {v.name}</option>))}
                </select>
                <input className="input input-bordered input-sm bg-white w-20" placeholder="Or type" value={takeAllRecBy} onChange={e => setTakeAllRecBy(e.target.value)} />
              </div>
            </div>

            {takeAllError && (
              <div className="rounded-lg bg-red-100 border border-red-300 p-3 text-sm text-red-800 font-medium text-center">
                ❌ {takeAllError}
              </div>
            )}

            {takeAllDone ? (
              <div className="rounded-lg bg-green-100 border border-green-300 p-3 text-sm text-green-800 font-medium text-center">
                ✅ {takeAllDone}
              </div>
            ) : !takeAllConfirm ? (
              <button
                className={`btn btn-sm w-full text-white ${isFridge ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700' : 'bg-cyan-600 hover:bg-cyan-700 border-cyan-700'}`}
                disabled={selectedItems.size === 0}
                onClick={() => { setTakeAllConfirm(true); takeAllTimer.current = setTimeout(() => setTakeAllConfirm(false), 5000); }}
              >
                <CheckCheck size={16} /> Take {selectedItems.size} Items
              </button>
            ) : (
              <button
                className={`btn btn-sm w-full text-white ${takeAllBusy ? 'bg-gray-400 border-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 border-red-600 animate-pulse'}`}
                disabled={takeAllBusy}
                onClick={async () => {
                  if (takeAllBusy) return;
                  setTakeAllBusy(true);
                  clearTimeout(takeAllTimer.current);
                  setTakeAllError('');
                  try {
                    const selected = availableItems.filter(i => selectedItems.has(i.id));
                    for (const item of selected) {
                      onTake(item.id, item.qty_remaining, takeAllBy.trim(), takeAllRecBy.trim(), takeAllDate);
                    }
                    setTakeAllDone(`${selected.length} items recorded as taken from ${isFridge ? 'Fridge' : 'Freezer'}!`);
                    setTakeAllConfirm(false);
                  } catch (err: any) {
                    setTakeAllError(`Failed: ${err?.message || 'Unknown error'}`);
                    setTakeAllConfirm(false);
                  } finally {
                    setTakeAllBusy(false);
                  }
                }}
              >
                {takeAllBusy ? '⏳ Processing...' : `⚠️ CONFIRM — Take ${selectedItems.size} Items Out`}
              </button>
            )}
          </div>
        </div>
      )}

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
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">📅 Date</span></label>
                  <input type="date" className="input input-bordered input-sm w-full bg-white" value={dateOut} onChange={e => setDateOut(e.target.value)} />
                </div>

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

                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">✍️ Recorded By (Volunteer)</span></label>
                  <div className="flex gap-2">
                    <select
                      className="select select-bordered select-sm bg-white flex-1"
                      value={recordedBy}
                      onChange={e => setRecordedBy(e.target.value)}
                    >
                      <option value="">Select volunteer...</option>
                      {volunteers.map(v => (
                        <option key={v.id} value={v.initials}>{v.initials} — {v.name}</option>
                      ))}
                    </select>
                    <input
                      className="input input-bordered input-sm bg-white w-20"
                      placeholder="Or type"
                      value={recordedBy}
                      onChange={e => setRecordedBy(e.target.value)}
                    />
                  </div>
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
                  {editingOutId === o.id ? (
                    /* ===== INLINE EDIT MODE ===== */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-base-200 px-1.5 py-0.5 rounded">{o.inward_id}</span>
                        <span className="font-bold text-sm">{o.item}</span>
                        <span className="text-xs font-bold text-blue-600">✏️ Editing</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-base-content/50 font-medium">Qty Taken</label>
                          <input type="number" className="input input-bordered input-xs w-full" min={1} value={editOutQty} onChange={e => setEditOutQty(Number(e.target.value))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-base-content/50 font-medium">Collected By</label>
                          <input className="input input-bordered input-xs w-full" value={editOutTakenBy} onChange={e => setEditOutTakenBy(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-base-content/50 font-medium">Recorded By</label>
                          <input className="input input-bordered input-xs w-full" value={editOutRecBy} onChange={e => setEditOutRecBy(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button className="btn btn-success btn-xs gap-1" onClick={saveEditOut}><Check size={12} /> Save</button>
                        <button className="btn btn-ghost btn-xs gap-1" onClick={() => setEditingOutId(null)}><X size={12} /> Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* ===== NORMAL VIEW MODE ===== */
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
                        {o.taken_by && ` · to ${o.taken_by}`}
                        {o.donor && ` · from ${o.donor}`}
                        {o.recorded_by && ` · ✍️ ${o.recorded_by}`}
                        {o.source === 'manual' && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">✋ MANUAL</span>
                        )}
                        {o.source === 'import' && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">📥 IMPORT</span>
                        )}
                        {o.source === 'bulk' && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">⚡ BULK</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button className="btn btn-ghost btn-xs text-blue-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => startEditOut(o)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs text-red-400 hover:text-red-600" onClick={() => onDelete(o.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
