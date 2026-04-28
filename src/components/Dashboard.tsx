import React, { useMemo } from 'react';
import { InwardItem, OutwardEntry, WastageEntry, StorageLocation, CATEGORY_COLOURS, Donor } from '../types';
import { Package, TrendingDown, Trash2, AlertTriangle, Snowflake, ThermometerSun, Clock, Award, Heart, Activity } from 'lucide-react';

interface DashboardProps {
  inwards: InwardItem[];
  outwards: OutwardEntry[];
  wastage: WastageEntry[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  onNavigate: (tab: 'inwards' | 'outwards' | 'wastage') => void;
  donors: Donor[];
}

const parseDateStr = (d: string): Date | null => {
  if (!d) return null;
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  const textDate = new Date(d);
  if (!isNaN(textDate.getTime())) return textDate;
  return null;
};

export const Dashboard: React.FC<DashboardProps> = ({ inwards, outwards, wastage, storage, onStorageChange, onNavigate, donors }) => {
  const filtered = inwards.filter(i => i.storage === storage);
  const filteredOut = outwards.filter(o => o.storage === storage);
  const filteredWaste = wastage.filter(w => w.storage === storage);

  const available = filtered.filter(i => i.status === 'available').length;
  const partial = filtered.filter(i => i.status === 'partial').length;
  const gone = filtered.filter(i => i.status === 'gone').length;
  const totalTaken = filteredOut.reduce((sum, o) => sum + o.qty_taken, 0);
  const totalWasted = filteredWaste.reduce((sum, w) => sum + w.qty_wasted, 0);

  const today = new Date();
  const twoDays = new Date(today); twoDays.setDate(twoDays.getDate() + 2);
  const sevenDays = new Date(today); sevenDays.setDate(sevenDays.getDate() + 7);

  // Expiry categories: expired, expiring today/tomorrow, expiring this week
  const expiryItems = useMemo(() => {
    const expired: InwardItem[] = [];
    const critical: InwardItem[] = []; // today/tomorrow
    const warning: InwardItem[] = [];  // within 7 days
    filtered.filter(i => i.best_before && i.status !== 'gone').forEach(i => {
      const parts = i.best_before!.split('/');
      if (parts.length !== 3) return;
      const expDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      expDate.setHours(23, 59, 59);
      if (expDate < today) expired.push(i);
      else if (expDate <= twoDays) critical.push(i);
      else if (expDate <= sevenDays) warning.push(i);
    });
    return { expired, critical, warning };
  }, [filtered]);

  // Donor leaderboard — across ALL storage (not filtered)
  const donorLeaderboard = useMemo(() => {
    const donorMap: Record<string, { qty: number; items: number }> = {};
    inwards.forEach(i => {
      const d = i.donor || 'Unknown';
      if (!donorMap[d]) donorMap[d] = { qty: 0, items: 0 };
      donorMap[d].qty += i.qty_in;
      donorMap[d].items += 1;
    });
    return Object.entries(donorMap)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);
  }, [inwards]);

  // Volunteer activity — across ALL storage
  const volunteerActivity = useMemo(() => {
    const volMap: Record<string, { inCount: number; outCount: number; wasteCount: number }> = {};
    inwards.forEach(i => {
      const v = i.entered_by || 'Unknown';
      if (!volMap[v]) volMap[v] = { inCount: 0, outCount: 0, wasteCount: 0 };
      volMap[v].inCount += 1;
    });
    outwards.forEach(o => {
      const v = o.recorded_by || 'Unknown';
      if (!volMap[v]) volMap[v] = { inCount: 0, outCount: 0, wasteCount: 0 };
      volMap[v].outCount += 1;
    });
    wastage.forEach(w => {
      const v = w.reported_by || 'Unknown';
      if (!volMap[v]) volMap[v] = { inCount: 0, outCount: 0, wasteCount: 0 };
      volMap[v].wasteCount += 1;
    });
    return Object.entries(volMap)
      .map(([name, d]) => ({ name, total: d.inCount + d.outCount + d.wasteCount, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [inwards, outwards, wastage]);

  // Recent activity feed — last 10 actions across all types
  const recentActivity = useMemo(() => {
    const activities: { type: 'in' | 'out' | 'waste'; item: string; date: string; time?: string; detail: string }[] = [];
    inwards.slice(-10).forEach(i => activities.push({ type: 'in', item: i.item, date: i.date_in, time: i.time_in, detail: `${i.qty_in} ${i.unit} added` }));
    outwards.slice(-10).forEach(o => activities.push({ type: 'out', item: o.item, date: o.date_taken, time: o.time_taken, detail: `${o.qty_taken} taken` }));
    wastage.slice(-10).forEach(w => activities.push({ type: 'waste', item: w.item, date: w.date_wasted, detail: `${w.qty_wasted} wasted` }));
    return activities
      .sort((a, b) => {
        const dA = parseDateStr(a.date)?.getTime() || 0;
        const dB = parseDateStr(b.date)?.getTime() || 0;
        return dB - dA;
      })
      .slice(0, 8);
  }, [inwards, outwards, wastage]);

  // Category breakdown for current storage
  const categoryBreakdown = useMemo(() => {
    const catMap: Record<string, { available: number; total: number }> = {};
    filtered.forEach(i => {
      if (!catMap[i.category]) catMap[i.category] = { available: 0, total: 0 };
      catMap[i.category].total += i.qty_in;
      catMap[i.category].available += i.qty_remaining;
    });
    return Object.entries(catMap).sort((a, b) => b[1].available - a[1].available);
  }, [filtered]);

  // Efficiency stat
  const totalIn = filtered.reduce((s, i) => s + i.qty_in, 0);
  const efficiencyPct = totalIn > 0 ? Math.round((totalTaken / totalIn) * 100) : 0;

  const isFridge = storage === 'fridge';
  const hasExpiry = expiryItems.expired.length + expiryItems.critical.length + expiryItems.warning.length > 0;

  return (
    <div className="space-y-3">
      {/* Storage toggle */}
      <div className="flex rounded-xl overflow-hidden border-2 border-base-300">
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold text-sm transition-all ${
            isFridge ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg' : 'bg-base-200 text-base-content/50 hover:bg-base-300'
          }`}
          onClick={() => onStorageChange('fridge')}
        >
          <ThermometerSun size={18} /> 🧊 Fridge
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold text-sm transition-all ${
            !isFridge ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' : 'bg-base-200 text-base-content/50 hover:bg-base-300'
          }`}
          onClick={() => onStorageChange('freezer')}
        >
          <Snowflake size={18} /> ❄️ Freezer
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('inwards')}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center"><Package size={16} className="text-white" /></div>
            <span className="text-emerald-700 text-xs font-medium">In Stock</span>
          </div>
          <div className="text-2xl font-bold text-emerald-900">{available + partial}</div>
          <div className="text-xs text-emerald-600">{available} full · {partial} partial</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('outwards')}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center"><TrendingDown size={16} className="text-white" /></div>
            <span className="text-blue-700 text-xs font-medium">Taken Out</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{totalTaken}</div>
          <div className="text-xs text-blue-600">{filteredOut.length} transactions</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('wastage')}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center"><Trash2 size={16} className="text-white" /></div>
            <span className="text-red-700 text-xs font-medium">Wasted</span>
          </div>
          <div className="text-2xl font-bold text-red-900">{totalWasted}</div>
          <div className="text-xs text-red-600">{filteredWaste.length} entries</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center"><TrendingDown size={16} className="text-white" /></div>
            <span className="text-violet-700 text-xs font-medium">Efficiency</span>
          </div>
          <div className="text-2xl font-bold text-violet-900">{efficiencyPct}%</div>
          <div className="text-xs text-violet-600">{totalTaken} of {totalIn} distributed</div>
        </div>
      </div>

      {/* 🚨 EXPIRY ALERTS — tiered */}
      {hasExpiry && (
        <div className="space-y-2">
          {expiryItems.expired.length > 0 && (
            <div className="rounded-xl bg-gradient-to-r from-red-100 to-red-50 border-2 border-red-400 p-3 animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-red-600" />
                <span className="font-bold text-red-800 text-sm">🔴 EXPIRED — Remove Immediately!</span>
                <span className="badge badge-sm bg-red-500 text-white border-0">{expiryItems.expired.length}</span>
              </div>
              <div className="space-y-1">
                {expiryItems.expired.map(i => (
                  <div key={i.id} className="flex items-center justify-between text-sm bg-red-50 rounded-lg px-2 py-1 border border-red-200">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-red-500">{i.id}</span>
                      <span className="font-bold text-red-900">{i.item}</span>
                      <span className="text-xs text-red-600">({i.qty_remaining} {i.unit})</span>
                    </span>
                    <span className="text-xs font-bold text-red-700">BB: {i.best_before}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiryItems.critical.length > 0 && (
            <div className="rounded-xl bg-gradient-to-r from-amber-100 to-yellow-50 border-2 border-amber-400 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={18} className="text-amber-600" />
                <span className="font-bold text-amber-800 text-sm">🟡 Expiring Today/Tomorrow — Use First!</span>
                <span className="badge badge-sm bg-amber-500 text-white border-0">{expiryItems.critical.length}</span>
              </div>
              <div className="space-y-1">
                {expiryItems.critical.map(i => (
                  <div key={i.id} className="flex items-center justify-between text-sm bg-amber-50 rounded-lg px-2 py-1 border border-amber-200">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-amber-500">{i.id}</span>
                      <span className="font-bold text-amber-900">{i.item}</span>
                      <span className="text-xs text-amber-600">({i.qty_remaining} {i.unit})</span>
                    </span>
                    <span className="text-xs font-bold text-amber-700">BB: {i.best_before}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiryItems.warning.length > 0 && (
            <div className="rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-300 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-sky-600" />
                <span className="font-bold text-sky-800 text-xs">🔵 Expiring This Week</span>
                <span className="badge badge-xs bg-sky-400 text-white border-0">{expiryItems.warning.length}</span>
              </div>
              <div className="space-y-1">
                {expiryItems.warning.map(i => (
                  <div key={i.id} className="flex items-center justify-between text-xs bg-sky-50 rounded-lg px-2 py-0.5 border border-sky-200">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-sky-500">{i.id}</span>
                      <span className="font-medium text-sky-900">{i.item}</span>
                    </span>
                    <span className="text-[10px] text-sky-600">BB: {i.best_before}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="rounded-xl border border-base-300 overflow-hidden">
          <div className="bg-base-200 px-4 py-2 border-b border-base-300">
            <h3 className="font-bold text-xs flex items-center gap-2">📦 Stock by Category</h3>
          </div>
          <div className="p-2 space-y-1">
            {categoryBreakdown.map(([cat, data]) => {
              const pct = data.total > 0 ? (data.available / data.total) * 100 : 0;
              const catCls = CATEGORY_COLOURS[cat] || CATEGORY_COLOURS['Other'];
              return (
                <div key={cat} className="px-2 py-1">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${catCls}`}>{cat}</span>
                    <span className="font-bold text-xs">{data.available} / {data.total}</span>
                  </div>
                  <div className="w-full bg-base-200 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${pct > 50 ? 'bg-emerald-400' : pct > 20 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🏆 Donor Leaderboard */}
      {donorLeaderboard.length > 0 && (
        <div className="rounded-xl border border-base-300 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-2 border-b border-amber-200">
            <h3 className="font-bold text-xs flex items-center gap-2"><Award size={14} className="text-amber-600" /> 🏆 Top Donors</h3>
          </div>
          <div className="p-2">
            {donorLeaderboard.map(([name, data], idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={name} className="flex items-center justify-between py-1.5 px-2 border-b border-base-200 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{idx < 3 ? medals[idx] : `#${idx + 1}`}</span>
                    <span className="font-medium text-sm">{name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-sm bg-amber-100 text-amber-700 border-amber-200">{data.qty} qty</span>
                    <span className="text-[10px] text-base-content/50">{data.items} items</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 👥 Volunteer Activity */}
      {volunteerActivity.length > 0 && (
        <div className="rounded-xl border border-base-300 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-2 border-b border-violet-200">
            <h3 className="font-bold text-xs flex items-center gap-2"><Heart size={14} className="text-violet-600" /> 👥 Volunteer Activity</h3>
          </div>
          <div className="p-2">
            <div className="overflow-x-auto">
              <table className="table table-xs w-full">
                <thead>
                  <tr className="text-[10px]">
                    <th>Volunteer</th><th className="text-center">📥 In</th><th className="text-center">📤 Out</th><th className="text-center">🗑️ Waste</th><th className="text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {volunteerActivity.map(v => (
                    <tr key={v.name} className="text-xs">
                      <td className="font-medium">{v.name}</td>
                      <td className="text-center"><span className="badge badge-xs bg-green-100 text-green-700 border-green-200">{v.inCount}</span></td>
                      <td className="text-center"><span className="badge badge-xs bg-blue-100 text-blue-700 border-blue-200">{v.outCount}</span></td>
                      <td className="text-center"><span className="badge badge-xs bg-red-100 text-red-700 border-red-200">{v.wasteCount}</span></td>
                      <td className="text-center font-bold">{v.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 📡 Recent Activity Feed */}
      {recentActivity.length > 0 && (
        <div className="rounded-xl border border-base-300 overflow-hidden">
          <div className="bg-base-200 px-4 py-2 border-b border-base-300">
            <h3 className="font-bold text-xs flex items-center gap-2"><Activity size={14} /> 📡 Recent Activity</h3>
          </div>
          <div className="p-2 space-y-1">
            {recentActivity.map((a, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg hover:bg-base-200 border-b border-base-100 last:border-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  a.type === 'in' ? 'bg-emerald-500' : a.type === 'out' ? 'bg-blue-500' : 'bg-red-500'
                }`} />
                <span className="font-medium flex-1">{a.item}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  a.type === 'in' ? 'bg-green-100 text-green-700' : a.type === 'out' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                }`}>{a.detail}</span>
                <span className="text-[10px] text-base-content/40">{a.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available items */}
      <div className="rounded-xl border border-base-300 overflow-hidden">
        <div className="bg-base-200 px-4 py-2 border-b border-base-300">
          <h3 className="font-bold text-sm">Currently in {isFridge ? '🧊 Fridge' : '❄️ Freezer'}</h3>
        </div>
        <div className="p-2">
          {filtered.filter(i => i.status !== 'gone').length === 0 ? (
            <p className="text-base-content/60 text-sm text-center py-6">No items in {storage}. Add items via the In tab.</p>
          ) : (
            <div className="space-y-1">
              {filtered.filter(i => i.status !== 'gone').map(i => {
                const catColour = CATEGORY_COLOURS[i.category] || CATEGORY_COLOURS['Other'];
                return (
                  <div key={i.id} className="flex items-center justify-between text-sm py-2 px-2 rounded-lg hover:bg-base-200 transition-colors border-b border-base-200 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-base-content/50">{i.id}</span>
                      <span className="font-medium">{i.item}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${catColour}`}>{i.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{i.qty_remaining} {i.unit}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${i.status === 'available' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
