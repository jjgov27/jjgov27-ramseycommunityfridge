import React, { useState, useMemo } from 'react';
import { Package, Trash2, Search } from 'lucide-react';
import { Delivery, Donor, Volunteer } from '../types';

interface DeliveriesTabProps {
  deliveries: Delivery[];
  donors: Donor[];
  volunteers: Volunteer[];
  activeVolunteer: string;
  onAdd: (date: string, time: string, donor: string, weightKg: number, itemCount: number, receivedBy: string, notes: string, totalValue: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const KG_TO_LBS = 2.20462;
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nowTime = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const isoToGB = (iso: string) => {
  if (!iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const capitalise = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

export const DeliveriesTab: React.FC<DeliveriesTabProps> = ({
  deliveries, donors, volunteers, activeVolunteer, onAdd, onDelete,
}) => {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
  const [donor, setDonor] = useState('');
  const [donorOpen, setDonorOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [count, setCount] = useState('');
  const [value, setValue] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const effectiveReceivedBy = receivedBy || activeVolunteer;

  const weightNum = parseFloat(weight);
  const lbsDisplay = !isNaN(weightNum) && weightNum > 0 ? (weightNum * KG_TO_LBS).toFixed(2) : '—';

  const donorMatches = useMemo(() => {
    const q = donor.trim().toLowerCase();
    return donors.filter(d => !q || d.name.toLowerCase().includes(q)).slice(0, 30);
  }, [donors, donor]);

  const totals = useMemo(() => ({
    count: deliveries.length,
    weight: deliveries.reduce((s, d) => s + (d.total_weight_kg || 0), 0),
    items: deliveries.reduce((s, d) => s + (d.item_count || 0), 0),
    value: deliveries.reduce((s, d) => s + (d.total_value || 0), 0),
  }), [deliveries]);

  const handleAdd = async () => {
    setError('');
    if (!donor.trim()) { setError('Please choose or enter a donor'); return; }
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) { setError('Please enter the total weight'); return; }
    const c = parseInt(count) || 0;
    const v = parseFloat(value) || 0;
    setSaving(true);
    try {
      await onAdd(isoToGB(date), time || nowTime(), capitalise(donor.trim()), w, c, effectiveReceivedBy, notes.trim(), v);
      setWeight(''); setCount(''); setValue(''); setNotes(''); setDonor('');
      setTime(nowTime());
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Delivery) => {
    if (!window.confirm(`Delete delivery from ${d.donor} on ${d.date}?`)) return;
    await onDelete(d.id);
  };

  const card = 'bg-white rounded-xl border border-emerald-200 shadow-sm p-3 text-center';

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className={card}><div className="text-xs text-gray-500">Total Deliveries</div><div className="text-xl font-extrabold text-emerald-700">{totals.count}</div></div>
        <div className={card}><div className="text-xs text-gray-500">Total Weight</div><div className="text-xl font-extrabold text-emerald-700">{totals.weight.toFixed(1)} kg</div></div>
        <div className={card}><div className="text-xs text-gray-500">Total Items</div><div className="text-xl font-extrabold text-emerald-700">{totals.items}</div></div>
        <div className={card}><div className="text-xs text-gray-500">Total Value</div><div className="text-xl font-extrabold text-emerald-700">£{totals.value.toFixed(2)}</div></div>
      </div>

      {/* Quick entry */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
        <div className="font-bold text-sm text-emerald-800 flex items-center gap-1"><Package size={16} /> Record Delivery</div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <label className="form-control">
            <span className="text-xs text-gray-600">Date</span>
            <input type="date" className="input input-bordered input-sm w-full" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="text-xs text-gray-600">Time</span>
            <input type="time" className="input input-bordered input-sm w-full" value={time} onChange={e => setTime(e.target.value)} />
          </label>
          <div className="form-control relative col-span-2 sm:col-span-1">
            <span className="text-xs text-gray-600">Donor</span>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                type="text" className="input input-bordered input-sm w-full pl-7" placeholder="Search donor..."
                value={donor}
                onChange={e => { setDonor(e.target.value); setDonorOpen(true); }}
                onFocus={() => setDonorOpen(true)}
                onBlur={() => setTimeout(() => setDonorOpen(false), 150)}
              />
            </div>
            {donorOpen && donorMatches.length > 0 && (
              <ul className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                {donorMatches.map(d => (
                  <li key={d.id}>
                    <button type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-emerald-50"
                      onMouseDown={e => { e.preventDefault(); setDonor(d.name); setDonorOpen(false); }}>
                      {d.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="form-control">
            <span className="text-xs text-gray-600">Total Weight (kg)</span>
            <input type="number" inputMode="decimal" step="0.01" min="0" className="input input-bordered input-sm w-full"
              value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.0" />
          </label>
          <div className="form-control">
            <span className="text-xs text-gray-600">Weight (lbs)</span>
            <div className="input input-bordered input-sm w-full flex items-center bg-gray-50 text-gray-600">{lbsDisplay}</div>
          </div>
          <label className="form-control">
            <span className="text-xs text-gray-600">Item Count</span>
            <input type="number" inputMode="numeric" min="0" step="1" className="input input-bordered input-sm w-full"
              value={count} onChange={e => setCount(e.target.value)} placeholder="0" />
          </label>
          <label className="form-control">
            <span className="text-xs text-gray-600">Value £ (optional)</span>
            <input type="number" inputMode="decimal" step="0.01" min="0" className="input input-bordered input-sm w-full"
              value={value} onChange={e => setValue(e.target.value)} placeholder="0.00" />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <label className="form-control">
            <span className="text-xs text-gray-600">Received By</span>
            <select className="select select-bordered select-sm w-full" value={effectiveReceivedBy} onChange={e => setReceivedBy(e.target.value)}>
              <option value="">Select...</option>
              {volunteers.map(v => <option key={v.id} value={v.initials}>{v.initials} — {v.name}</option>)}
            </select>
          </label>
          <label className="form-control sm:col-span-2">
            <span className="text-xs text-gray-600">Notes</span>
            <input type="text" className="input input-bordered input-sm w-full" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
          </label>
          <button className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-1" onClick={handleAdd} disabled={saving}>
            <Package size={14} /> {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
        {error && <div className="text-xs text-red-600 font-medium">{error}</div>}
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="table table-xs w-full">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th>Date</th><th>Time</th><th>Donor</th><th className="text-right">Weight (kg)</th><th className="text-right">Weight (lbs)</th>
              <th className="text-right">Items</th><th className="text-right">Value (£)</th><th>Received By</th><th>Notes</th><th>Source</th><th></th>
            </tr>
          </thead>
          <tbody>
            {deliveries.length === 0 && (
              <tr><td colSpan={11} className="text-center text-gray-400 py-6">No deliveries recorded yet</td></tr>
            )}
            {deliveries.map(d => (
              <tr key={d.id} className="hover:bg-emerald-50/40">
                <td className="whitespace-nowrap">{d.date}</td>
                <td>{d.time}</td>
                <td className="font-medium">{d.donor}</td>
                <td className="text-right">{d.total_weight_kg.toFixed(2)}</td>
                <td className="text-right">{(d.total_weight_kg * KG_TO_LBS).toFixed(2)}</td>
                <td className="text-right">{d.item_count}</td>
                <td className="text-right">{d.total_value > 0 ? `£${d.total_value.toFixed(2)}` : '—'}</td>
                <td>{d.received_by}</td>
                <td className="max-w-[160px] truncate" title={d.notes}>{d.notes}</td>
                <td>
                  {d.source === 'foodiverse'
                    ? <span className="badge badge-sm bg-purple-100 text-purple-800 border-purple-300 whitespace-nowrap">🟣 📥 FOODIVERSE</span>
                    : <span className="badge badge-sm bg-green-100 text-green-800 border-green-300 whitespace-nowrap">🟢 ✋ MANUAL</span>}
                </td>
                <td>
                  <button className="btn btn-ghost btn-xs text-red-500" onClick={() => handleDelete(d)} title="Delete"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          {deliveries.length > 0 && (
            <tfoot>
              <tr className="font-bold bg-emerald-50 text-emerald-800">
                <td colSpan={3}>Totals</td>
                <td className="text-right">{totals.weight.toFixed(2)}</td>
                <td className="text-right">{(totals.weight * KG_TO_LBS).toFixed(2)}</td>
                <td className="text-right">{totals.items}</td>
                <td className="text-right">£{totals.value.toFixed(2)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
