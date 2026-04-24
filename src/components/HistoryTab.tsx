import React, { useState } from 'react';
import { Search, Download, Printer, Trash2, ChevronDown, ChevronUp, Archive } from 'lucide-react';
import { ArchivedRecord, StorageLocation, CATEGORY_COLOURS } from '../types';
import { archiveToCSV } from '../utils/db';

interface HistoryTabProps {
  archive: ArchivedRecord[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  onDelete: (id: string) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ archive, storage, onStorageChange, onDelete }) => {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = archive.filter(a => {
    if (a.storage !== storage) return false;
    if (search && !a.item.toLowerCase().includes(search.toLowerCase()) && !a.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom || dateTo) {
      // Parse archived_date (DD/MM/YYYY) to comparable format
      const parts = a.archived_date.split('/');
      if (parts.length === 3) {
        const archDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        if (dateFrom && archDate < dateFrom) return false;
        if (dateTo && archDate > dateTo) return false;
      }
    }
    return true;
  });

  const handleDownloadCSV = () => {
    const csv = archiveToCSV(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fridge-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printContent = `
      <html><head><title>Community Fridge History</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f0f0f0; font-weight: bold; }
        h1 { font-size: 18px; }
        .meta { color: #666; font-size: 11px; }
      </style></head><body>
      <h1>🧊 Community Fridge — History (${storage === 'fridge' ? 'Fridge' : 'Freezer'})</h1>
      <p class="meta">Printed: ${new Date().toLocaleDateString('en-GB')} | Records: ${filtered.length}</p>
      <table>
        <tr><th>ID</th><th>Item</th><th>Category</th><th>Qty In</th><th>Taken</th><th>Wasted</th><th>Date In</th><th>Archived</th></tr>
        ${filtered.map(a => `<tr><td>${a.id}</td><td>${a.item}</td><td>${a.category}</td><td>${a.qty_in} ${a.unit}</td><td>${a.total_taken}</td><td>${a.total_wasted}</td><td>${a.date_in}</td><td>${a.archived_date}</td></tr>`).join('')}
      </table></body></html>
    `;
    const w = window.open('', '_blank', 'width=800,height=600');
    if (w) { w.document.write(printContent); w.document.close(); w.print(); }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive size={18} className="text-primary" />
          <h2 className="font-bold text-base">History</h2>
          <span className="badge badge-sm">{filtered.length} records</span>
        </div>
        <div className="flex gap-1">
          <button
            className={`btn btn-xs ${storage === 'fridge' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onStorageChange('fridge')}
          >❄️ Fridge</button>
          <button
            className={`btn btn-xs ${storage === 'freezer' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onStorageChange('freezer')}
          >🧊 Freezer</button>
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap gap-2">
        <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-[150px]">
          <Search className="h-[1em] opacity-50" />
          <input type="search" className="grow" placeholder="Search item or ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <input type="date" className="input input-bordered input-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
        <input type="date" className="input input-bordered input-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button className="btn btn-sm btn-outline" onClick={handleDownloadCSV} disabled={filtered.length === 0}>
          <Download size={14} /> CSV
        </button>
        <button className="btn btn-sm btn-outline" onClick={handlePrint} disabled={filtered.length === 0}>
          <Printer size={14} /> Print
        </button>
      </div>

      {/* Archive list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-base-content/50">
          <Archive size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No archived records{search ? ' matching your search' : ''}</p>
          <p className="text-xs mt-1">Use "Clear to History" on the Home tab to archive completed items</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const isExpanded = expandedId === a.id;
            const catColour = CATEGORY_COLOURS[a.category] || CATEGORY_COLOURS['Other'];
            let outwards: Record<string, unknown>[] = [];
            let wastageList: Record<string, unknown>[] = [];
            try { outwards = JSON.parse(a.outwards_json); } catch (_) { /* ignore */ }
            try { wastageList = JSON.parse(a.wastage_json); } catch (_) { /* ignore */ }

            return (
              <div key={a.id} className="card bg-base-200 shadow-sm">
                <div className="card-body p-3">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-mono text-xs text-base-content/50">{a.id}</span>
                      <span className="font-semibold text-sm">{a.item}</span>
                      <span className={`badge badge-xs border ${catColour}`}>{a.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-base-content/50">Archived {a.archived_date}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="flex gap-3 text-xs mt-1">
                    <span>📦 In: <strong>{a.qty_in} {a.unit}</strong></span>
                    <span>📤 Taken: <strong>{a.total_taken}</strong></span>
                    <span>🗑️ Wasted: <strong>{a.total_wasted}</strong></span>
                    <span>📅 {a.date_in}</span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-2 space-y-2 border-t border-base-300 pt-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-base-content/50">Donor:</span> {a.donor || '—'}</div>
                        <div><span className="text-base-content/50">Best Before:</span> {a.best_before || '—'}</div>
                        <div><span className="text-base-content/50">Storage:</span> {a.storage === 'fridge' ? '❄️ Fridge' : '🧊 Freezer'}</div>
                      </div>

                      {outwards.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">📤 Outwards ({outwards.length})</p>
                          <div className="overflow-x-auto">
                            <table className="table table-xs">
                              <thead><tr><th>Qty</th><th>Date</th><th>Time</th><th>Taken By</th></tr></thead>
                              <tbody>
                                {outwards.map((o, i) => (
                                  <tr key={i}><td>{String(o.qty_taken)}</td><td>{String(o.date_taken)}</td><td>{String(o.time_taken)}</td><td>{String(o.taken_by || '—')}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {wastageList.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">🗑️ Wastage ({wastageList.length})</p>
                          <div className="overflow-x-auto">
                            <table className="table table-xs">
                              <thead><tr><th>Qty</th><th>Reason</th><th>Date</th><th>Notes</th></tr></thead>
                              <tbody>
                                {wastageList.map((w, i) => (
                                  <tr key={i}><td>{String(w.qty_wasted)}</td><td>{String(w.reason)}</td><td>{String(w.date_wasted)}</td><td>{String(w.notes || '—')}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button className="btn btn-xs btn-error btn-outline" onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}>
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
