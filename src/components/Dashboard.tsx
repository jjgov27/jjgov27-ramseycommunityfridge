import React from 'react';
import { InwardItem, OutwardEntry, WastageEntry, StorageLocation, CATEGORY_COLOURS } from '../types';
import { Package, TrendingDown, Trash2, AlertTriangle, Snowflake, ThermometerSun } from 'lucide-react';

interface DashboardProps {
  inwards: InwardItem[];
  outwards: OutwardEntry[];
  wastage: WastageEntry[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  onNavigate: (tab: 'inwards' | 'outwards' | 'wastage') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ inwards, outwards, wastage, storage, onStorageChange, onNavigate }) => {
  const filtered = inwards.filter(i => i.storage === storage);
  const filteredOut = outwards.filter(o => o.storage === storage);
  const filteredWaste = wastage.filter(w => w.storage === storage);

  const available = filtered.filter(i => i.status === 'available').length;
  const partial = filtered.filter(i => i.status === 'partial').length;
  const gone = filtered.filter(i => i.status === 'gone').length;
  const totalTaken = filteredOut.reduce((sum, o) => sum + o.qty_taken, 0);
  const totalWasted = filteredWaste.reduce((sum, w) => sum + w.qty_wasted, 0);

  const today = new Date();
  const twoDays = new Date(today);
  twoDays.setDate(twoDays.getDate() + 2);

  const expiringSoon = filtered.filter(i => {
    if (!i.best_before || i.status === 'gone') return false;
    const parts = i.best_before.split('/');
    if (parts.length !== 3) return false;
    const expDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return expDate <= twoDays;
  });

  const isFridge = storage === 'fridge';

  return (
    <div className="space-y-4">
      {/* Storage toggle */}
      <div className="flex rounded-xl overflow-hidden border-2 border-base-300">
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold text-sm transition-all ${
            isFridge
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
              : 'bg-base-200 text-base-content/50 hover:bg-base-300'
          }`}
          onClick={() => onStorageChange('fridge')}
        >
          <ThermometerSun size={18} />
          🧊 Fridge
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold text-sm transition-all ${
            !isFridge
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
              : 'bg-base-200 text-base-content/50 hover:bg-base-300'
          }`}
          onClick={() => onStorageChange('freezer')}
        >
          <Snowflake size={18} />
          ❄️ Freezer
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate('inwards')}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Package size={16} className="text-white" />
            </div>
            <span className="text-emerald-700 text-xs font-medium">In Stock</span>
          </div>
          <div className="text-2xl font-bold text-emerald-900">{available + partial}</div>
          <div className="text-xs text-emerald-600">{available} full · {partial} partial</div>
        </div>

        <div
          className="rounded-xl bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate('outwards')}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <TrendingDown size={16} className="text-white" />
            </div>
            <span className="text-blue-700 text-xs font-medium">Taken Out</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{totalTaken}</div>
          <div className="text-xs text-blue-600">{filteredOut.length} transactions</div>
        </div>

        <div
          className="rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate('wastage')}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
              <Trash2 size={16} className="text-white" />
            </div>
            <span className="text-red-700 text-xs font-medium">Wasted</span>
          </div>
          <div className="text-2xl font-bold text-red-900">{totalWasted}</div>
          <div className="text-xs text-red-600">{filteredWaste.length} entries</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
              <Package size={16} className="text-white" />
            </div>
            <span className="text-violet-700 text-xs font-medium">Total Logged</span>
          </div>
          <div className="text-2xl font-bold text-violet-900">{filtered.length}</div>
          <div className="text-xs text-violet-600">{gone} fully distributed</div>
        </div>
      </div>

      {/* Expiring soon alert */}
      {expiringSoon.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <span className="font-bold text-amber-800 text-sm">⚠️ Expiring Soon!</span>
          </div>
          <div className="space-y-1">
            {expiringSoon.map(i => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-amber-600">{i.id}</span>
                  <span className="font-medium text-amber-900">{i.item}</span>
                </span>
                <span className="text-xs text-amber-700">BB: {i.best_before}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available items */}
      <div className="rounded-xl border border-base-300 overflow-hidden">
        <div className="bg-base-200 px-4 py-2 border-b border-base-300">
          <h3 className="font-bold text-sm">
            Currently in {isFridge ? '🧊 Fridge' : '❄️ Freezer'}
          </h3>
        </div>
        <div className="p-2">
          {filtered.filter(i => i.status !== 'gone').length === 0 ? (
            <p className="text-base-content/60 text-sm text-center py-6">
              No items in {storage}. Add items via the In tab.
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.filter(i => i.status !== 'gone').map(i => {
                const catColour = CATEGORY_COLOURS[i.category] || CATEGORY_COLOURS['Other'];
                return (
                  <div key={i.id} className="flex items-center justify-between text-sm py-2 px-2 rounded-lg hover:bg-base-200 transition-colors border-b border-base-200 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-base-content/50">{i.id}</span>
                      <span className="font-medium">{i.item}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${catColour}`}>
                        {i.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{i.qty_remaining} {i.unit}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        i.status === 'available' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
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
