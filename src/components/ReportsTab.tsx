import React, { useState, useMemo } from 'react';
import { FileBarChart, Download, Calendar, Filter, TrendingUp, AlertTriangle, PackagePlus, Users, ListPlus, Database } from 'lucide-react';
import { WastageEntry, InwardItem, StorageLocation, CATEGORY_COLOURS, CustomItem, ArchivedRecord } from '../types';

interface Props {
  inwards: InwardItem[];
  wastage: WastageEntry[];
  outwards: { inward_id: string; item: string; category: string; storage: StorageLocation; qty_taken: number; date_taken: string; time_taken: string; taken_by: string }[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  archive: ArchivedRecord[];
  customItems: CustomItem[];
}

const parseDateStr = (d: string): Date | null => {
  if (!d) return null;
  // DD/MM/YYYY
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [year, month, day] = d.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  // Text format: "26 Feb 2026", "1 Mar 2026", etc.
  const textDate = new Date(d);
  if (!isNaN(textDate.getTime())) return textDate;
  return null;
};

const toISODate = (d: Date) => d.toISOString().split('T')[0];

export const ReportsTab: React.FC<Props> = ({ inwards, wastage, outwards, storage, onStorageChange, archive, customItems }) => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(toISODate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(toISODate(today));
  const [reportType, setReportType] = useState<'inwards' | 'wastage' | 'outwards' | 'all'>('inwards');

  const isFullReport = reportType === 'all';

  // For Full Report: reconstruct archived outwards/wastage from JSON
  const archivedInwards = useMemo(() => {
    return archive.map(a => ({
      id: a.id,
      item: a.item,
      category: a.category,
      qty: a.qty_in,
      qty_in: a.qty_in,
      unit: a.unit,
      date: a.date_in,
      date_in: a.date_in,
      time: '',
      time_in: '',
      donor: a.donor,
      entered_by: '',
      expiry: a.best_before,
      best_before: a.best_before,
      storage: a.storage,
      qtyRemaining: 0,
      qty_remaining: 0,
      totalTaken: a.total_taken,
      total_taken: a.total_taken,
      totalWasted: a.total_wasted,
      total_wasted: a.total_wasted,
      status: 'gone' as const,
      _archived: true,
    }));
  }, [archive]);

  const archivedOutwards = useMemo(() => {
    const out: { inward_id: string; item: string; category: string; storage: StorageLocation; qty_taken: number; date_taken: string; time_taken: string; taken_by: string }[] = [];
    archive.forEach(a => {
      try {
        const entries = JSON.parse(a.outwards_json || '[]');
        entries.forEach((e: any) => {
          out.push({
            inward_id: e.inward_id || a.id,
            item: a.item,
            category: a.category,
            storage: a.storage,
            qty_taken: e.qty_taken || 1,
            date_taken: e.date_taken || a.date_in,
            time_taken: e.time_taken || '',
            taken_by: e.taken_by || '',
          });
        });
      } catch {}
    });
    return out;
  }, [archive]);

  const archivedWastage = useMemo(() => {
    const wast: WastageEntry[] = [];
    archive.forEach(a => {
      try {
        const entries = JSON.parse(a.wastage_json || '[]');
        entries.forEach((e: any) => {
          wast.push({
            id: e.id || 0,
            inward_id: e.inward_id || a.id,
            item: a.item,
            category: a.category,
            storage: a.storage,
            qty_wasted: e.qty_wasted || 1,
            reason: e.reason || 'Unknown',
            date_wasted: e.date_wasted || a.date_in,
            reported_by: e.reported_by || '',
            notes: e.notes || '',
          });
        });
      } catch {}
    });
    return wast;
  }, [archive]);

  // Combined data (live + archived for Full Report)
  const allInwards = useMemo(() => isFullReport ? [...inwards, ...archivedInwards] : inwards, [isFullReport, inwards, archivedInwards]);
  const allOutwards = useMemo(() => isFullReport ? [...outwards, ...archivedOutwards] : outwards, [isFullReport, outwards, archivedOutwards]);
  const allWastage = useMemo(() => isFullReport ? [...wastage, ...archivedWastage] : wastage, [isFullReport, wastage, archivedWastage]);

  // Filtered inwards - Full Report = both storages; otherwise filter by selected storage
  const filteredInwards = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    return allInwards.filter(i => {
      if (!isFullReport && i.storage !== storage) return false;
      const d = parseDateStr(i.date || i.date_in);
      if (!d) return false;
      return d >= start && d <= end;
    });
  }, [allInwards, storage, startDate, endDate, isFullReport]);

  const filteredWastage = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    return allWastage.filter(w => {
      if (!isFullReport && w.storage !== storage) return false;
      const d = parseDateStr(w.date_wasted);
      if (!d) return false;
      return d >= start && d <= end;
    });
  }, [allWastage, storage, startDate, endDate, isFullReport]);

  const filteredOutwards = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    return allOutwards.filter(o => {
      if (!isFullReport && o.storage !== storage) return false;
      const d = parseDateStr(o.date_taken);
      if (!d) return false;
      return d >= start && d <= end;
    });
  }, [allOutwards, storage, startDate, endDate, isFullReport]);

  // Inwards stats
  const totalInQty = filteredInwards.reduce((s, i) => s + (i.qty || i.qty_in || 0), 0);

  const inwardsByCategory = useMemo(() => {
    const map: Record<string, { qty: number; items: string[] }> = {};
    filteredInwards.forEach(i => {
      if (!map[i.category]) map[i.category] = { qty: 0, items: [] };
      map[i.category].qty += (i.qty || i.qty_in || 0);
      if (!map[i.category].items.includes(i.item)) map[i.category].items.push(i.item);
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredInwards]);

  const inwardsByItem = useMemo(() => {
    const map: Record<string, { qty: number; category: string; donors: Set<string>; storages: Set<string> }> = {};
    filteredInwards.forEach(i => {
      if (!map[i.item]) map[i.item] = { qty: 0, category: i.category, donors: new Set(), storages: new Set() };
      map[i.item].qty += (i.qty || i.qty_in || 0);
      if (i.donor) map[i.item].donors.add(i.donor);
      map[i.item].storages.add(i.storage);
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredInwards]);

  const inwardsByDonor = useMemo(() => {
    const map: Record<string, { qty: number; items: Set<string> }> = {};
    filteredInwards.forEach(i => {
      const donor = i.donor || 'Unknown';
      if (!map[donor]) map[donor] = { qty: 0, items: new Set() };
      map[donor].qty += (i.qty || i.qty_in || 0);
      map[donor].items.add(i.item);
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredInwards]);

  // Storage breakdown for full report
  const inwardsByStorage = useMemo(() => {
    if (!isFullReport) return [];
    const map: Record<string, number> = {};
    filteredInwards.forEach(i => {
      const s = i.storage || 'fridge';
      map[s] = (map[s] || 0) + (i.qty || i.qty_in || 0);
    });
    return Object.entries(map);
  }, [filteredInwards, isFullReport]);

  const maxInwardsQty = inwardsByItem.length > 0 ? inwardsByItem[0][1].qty : 1;

  // Wastage stats
  const wastageByCategory = useMemo(() => {
    const map: Record<string, { qty: number; items: string[] }> = {};
    filteredWastage.forEach(w => {
      if (!map[w.category]) map[w.category] = { qty: 0, items: [] };
      map[w.category].qty += w.qty_wasted;
      if (!map[w.category].items.includes(w.item)) map[w.category].items.push(w.item);
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredWastage]);

  const wastageByItem = useMemo(() => {
    const map: Record<string, { qty: number; category: string; reasons: Record<string, number> }> = {};
    filteredWastage.forEach(w => {
      if (!map[w.item]) map[w.item] = { qty: 0, category: w.category, reasons: {} };
      map[w.item].qty += w.qty_wasted;
      map[w.item].reasons[w.reason] = (map[w.item].reasons[w.reason] || 0) + w.qty_wasted;
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredWastage]);

  const wastageByReason = useMemo(() => {
    const map: Record<string, number> = {};
    filteredWastage.forEach(w => {
      map[w.reason] = (map[w.reason] || 0) + w.qty_wasted;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredWastage]);

  const totalWasted = filteredWastage.reduce((s, w) => s + w.qty_wasted, 0);
  const totalTaken = filteredOutwards.reduce((s, o) => s + o.qty_taken, 0);

  // Outwards stats
  const outwardsByItem = useMemo(() => {
    const map: Record<string, { qty: number; category: string; people: Set<string> }> = {};
    filteredOutwards.forEach(o => {
      if (!map[o.item]) map[o.item] = { qty: 0, category: o.category, people: new Set() };
      map[o.item].qty += o.qty_taken;
      if (o.taken_by) map[o.item].people.add(o.taken_by);
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredOutwards]);

  // All initials/volunteers in system (live + archive)
  const allInitials = useMemo(() => {
    const set = new Set<string>();
    // From live inwards entered_by
    inwards.forEach(i => { if (i.entered_by) set.add(i.entered_by); });
    // From live outwards taken_by
    outwards.forEach(o => { if (o.taken_by) set.add(o.taken_by); });
    // From live wastage reported_by
    wastage.forEach(w => { if (w.reported_by) set.add(w.reported_by); });
    // From archived outwards/wastage
    archivedOutwards.forEach(o => { if (o.taken_by) set.add(o.taken_by); });
    archivedWastage.forEach(w => { if (w.reported_by) set.add(w.reported_by); });
    return Array.from(set).sort();
  }, [inwards, outwards, wastage, archivedOutwards, archivedWastage]);

  const downloadCSV = () => {
    let csv = '';
    const storageLabel = isFullReport ? 'All (Fridge + Freezer)' : storage;

    if (reportType === 'inwards' || reportType === 'all') {
      csv += 'INWARDS REPORT\n';
      csv += `Storage,${storageLabel}\n`;
      csv += `Period,${startDate} to ${endDate}\n`;
      csv += isFullReport ? `Includes,Live + Archived data\n\n` : '\n';
      csv += 'ID,Item,Category,Qty,Storage,Donor/Source,Entered By,Date,Time,Expiry,Status,Source\n';
      filteredInwards.forEach(i => {
        const status = (i.qty_remaining ?? i.qtyRemaining ?? 0) <= 0 ? 'All Gone' : (i.total_taken ?? i.totalTaken ?? 0) > 0 || (i.total_wasted ?? i.totalWasted ?? 0) > 0 ? 'Partial' : 'Available';
        const src = (i as any)._archived ? 'Archived' : 'Live';
        csv += `"${i.id}","${i.item}","${i.category}",${i.qty || i.qty_in},"${i.storage}","${i.donor || ''}","${i.entered_by || ''}","${i.date || i.date_in}","${i.time || i.time_in || ''}","${i.expiry || i.best_before || ''}","${status}","${src}"\n`;
      });
      csv += `\nTotal Items In,,,${totalInQty}\n`;
      csv += `Total Entries,,,${filteredInwards.length}\n\n`;

      csv += 'INWARDS BY CATEGORY\n';
      csv += 'Category,Qty,Unique Items\n';
      inwardsByCategory.forEach(([cat, data]) => {
        csv += `"${cat}",${data.qty},${data.items.length}\n`;
      });
      csv += '\n';

      csv += 'INWARDS BY DONOR/SOURCE\n';
      csv += 'Donor/Source,Qty,Unique Items\n';
      inwardsByDonor.forEach(([donor, data]) => {
        csv += `"${donor}",${data.qty},${data.items.size}\n`;
      });
      csv += '\n';
    }
    if (reportType === 'wastage' || reportType === 'all') {
      csv += 'WASTAGE REPORT\n';
      csv += `Storage,${storageLabel}\n`;
      csv += `Period,${startDate} to ${endDate}\n\n`;
      csv += 'Item,Category,Qty Wasted,Reason,Date,Notes\n';
      filteredWastage.forEach(w => {
        csv += `"${w.item}","${w.category}",${w.qty_wasted},"${w.reason}","${w.date_wasted}","${w.notes || ''}"\n`;
      });
      csv += `\nTotal Wasted,,,${totalWasted}\n\n`;
      csv += 'WASTAGE BY CATEGORY\n';
      csv += 'Category,Qty Wasted\n';
      wastageByCategory.forEach(([cat, data]) => {
        csv += `"${cat}",${data.qty}\n`;
      });
      csv += '\n';
    }
    if (reportType === 'outwards' || reportType === 'all') {
      csv += 'OUTWARDS REPORT\n';
      csv += `Storage,${storageLabel}\n`;
      csv += `Period,${startDate} to ${endDate}\n\n`;
      csv += 'Item,Category,Storage,Qty Taken,Taken By,Date\n';
      filteredOutwards.forEach(o => {
        csv += `"${o.item}","${o.category}","${o.storage}",${o.qty_taken},"${o.taken_by}","${o.date_taken}"\n`;
      });
      csv += `\nTotal Taken,,,${totalTaken}\n\n`;
    }
    if (reportType === 'all') {
      csv += 'ITEMS IN SYSTEM\n';
      csv += 'Name,Category\n';
      customItems.forEach(ci => {
        csv += `"${ci.name}","${ci.category}"\n`;
      });
      csv += `\nTotal Items,${customItems.length}\n\n`;

      csv += 'INITIALS / VOLUNTEERS IN SYSTEM\n';
      csv += 'Name/Initials\n';
      allInitials.forEach(name => {
        csv += `"${name}"\n`;
      });
      csv += `\nTotal,${allInitials.length}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `community-fridge-${reportType}-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxWastageQty = wastageByItem.length > 0 ? wastageByItem[0][1].qty : 1;
  const maxOutwardsQty = outwardsByItem.length > 0 ? outwardsByItem[0][1].qty : 1;

  return (
    <div className="space-y-3">
      {/* Storage toggle - hidden for Full Report */}
      {!isFullReport && (
        <div className="flex items-center gap-2">
          <button className={`btn btn-xs ${storage === 'fridge' ? 'btn-success' : 'btn-ghost'}`} onClick={() => onStorageChange('fridge')}>🧊 Fridge</button>
          <button className={`btn btn-xs ${storage === 'freezer' ? 'btn-info' : 'btn-ghost'}`} onClick={() => onStorageChange('freezer')}>❄️ Freezer</button>
        </div>
      )}

      {/* Full report banner */}
      {isFullReport && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 flex items-center gap-2">
          <Database size={14} className="text-amber-600" />
          <span><strong>Full Report</strong> — showing all data (live + archived) across both Fridge &amp; Freezer</span>
        </div>
      )}

      {/* Report controls */}
      <div className="card bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 shadow-sm">
        <div className="card-body p-3 space-y-3">
          <div className="flex items-center gap-2">
            <FileBarChart size={16} className="text-violet-600" />
            <span className="font-bold text-sm text-violet-800">Generate Report</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-medium text-violet-700 flex items-center gap-1 mb-1"><Calendar size={10} /> From</label>
              <input type="date" className="input input-bordered input-xs w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-medium text-violet-700 flex items-center gap-1 mb-1"><Calendar size={10} /> To</label>
              <input type="date" className="input input-bordered input-xs w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-medium text-violet-700 flex items-center gap-1 mb-1"><Filter size={10} /> Type</label>
              <select className="select select-bordered select-xs w-full" value={reportType} onChange={e => setReportType(e.target.value as any)}>
                <option value="inwards">📥 Inwards Only</option>
                <option value="wastage">🗑️ Wastage Only</option>
                <option value="outwards">📤 Outwards Only</option>
                <option value="all">📊 Full Report (All)</option>
              </select>
            </div>
          </div>

          <button className="btn btn-xs btn-primary gap-1" onClick={downloadCSV}>
            <Download size={12} /> Download CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className={`grid ${isFullReport ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
        {(reportType === 'inwards' || reportType === 'all') && (
          <div className="card bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200">
            <div className="card-body p-3 text-center">
              <PackagePlus size={16} className="text-green-500 mx-auto" />
              <p className="text-2xl font-bold text-green-700">{totalInQty}</p>
              <p className="text-xs text-green-500">Total Received</p>
              <p className="text-xs text-green-400">{filteredInwards.length} entries</p>
            </div>
          </div>
        )}
        {(reportType === 'wastage' || reportType === 'all') && (
          <div className="card bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
            <div className="card-body p-3 text-center">
              <AlertTriangle size={16} className="text-red-500 mx-auto" />
              <p className="text-2xl font-bold text-red-700">{totalWasted}</p>
              <p className="text-xs text-red-500">Total Wasted</p>
              <p className="text-xs text-red-400">{filteredWastage.length} entries</p>
            </div>
          </div>
        )}
        {(reportType === 'outwards' || reportType === 'all') && (
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <div className="card-body p-3 text-center">
              <TrendingUp size={16} className="text-blue-500 mx-auto" />
              <p className="text-2xl font-bold text-blue-700">{totalTaken}</p>
              <p className="text-xs text-blue-500">Total Taken</p>
              <p className="text-xs text-blue-400">{filteredOutwards.length} entries</p>
            </div>
          </div>
        )}
      </div>

      {/* Storage breakdown for full report */}
      {isFullReport && inwardsByStorage.length > 0 && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-3 space-y-2">
            <p className="text-xs font-bold text-amber-700">📍 Inwards by Storage Location</p>
            {inwardsByStorage.map(([loc, qty]) => (
              <div key={loc} className="flex items-center justify-between text-xs">
                <span className="font-medium">{loc === 'fridge' ? '🧊 Fridge' : '❄️ Freezer'}</span>
                <span className="font-bold">{qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inwards breakdown */}
      {(reportType === 'inwards' || reportType === 'all') && (
        <>
          {inwardsByItem.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-green-700">📥 Inwards by Item {isFullReport && <span className="font-normal text-amber-600">(live + archived)</span>}</p>
                {inwardsByItem.map(([item, data]) => {
                  const pct = (data.qty / maxInwardsQty) * 100;
                  const catCls = CATEGORY_COLOURS[data.category] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={item} className="border-l-2 border-green-300 pl-2">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-medium">{item}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catCls}`}>{data.category}</span>
                          {isFullReport && data.storages.size > 0 && (
                            <span className="text-[10px] text-base-content/40">
                              {Array.from(data.storages).map(s => s === 'fridge' ? '🧊' : '❄️').join('')}
                            </span>
                          )}
                        </div>
                        <span className="text-green-600 font-bold">{data.qty}</span>
                      </div>
                      <div className="w-full bg-green-100 rounded-full h-1.5">
                        <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      {data.donors.size > 0 && (
                        <p className="text-[10px] text-base-content/50 mt-0.5">
                          {data.donors.size} source{data.donors.size !== 1 ? 's' : ''}: {Array.from(data.donors).slice(0, 3).join(', ')}{data.donors.size > 3 ? '...' : ''}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By category */}
          {inwardsByCategory.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-green-700">📦 Inwards by Category</p>
                {inwardsByCategory.map(([cat, data]) => {
                  const pct = totalInQty > 0 ? (data.qty / totalInQty) * 100 : 0;
                  const catCls = CATEGORY_COLOURS[cat] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${catCls}`}>{cat}</span>
                          <span className="text-base-content/50">{data.items.length} item{data.items.length !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="font-bold text-green-600">{data.qty} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-green-100 rounded-full h-2">
                        <div className="bg-green-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By donor/source */}
          {inwardsByDonor.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-green-700">🤝 Inwards by Donor / Source</p>
                {inwardsByDonor.map(([donor, data]) => {
                  const pct = totalInQty > 0 ? (data.qty / totalInQty) * 100 : 0;
                  return (
                    <div key={donor} className="flex items-center justify-between text-xs border-l-2 border-emerald-300 pl-2 py-0.5">
                      <div>
                        <span className="font-medium">{donor}</span>
                        <span className="text-base-content/40 ml-1">({data.items.size} item{data.items.size !== 1 ? 's' : ''})</span>
                      </div>
                      <span className="font-bold text-green-600">{data.qty} ({pct.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredInwards.length === 0 && (
            <div className="text-center py-8 text-base-content/40">
              <PackagePlus size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No inward entries in this period</p>
            </div>
          )}
        </>
      )}

      {/* Wastage breakdown */}
      {(reportType === 'wastage' || reportType === 'all') && (
        <>
          {/* By reason */}
          {wastageByReason.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-red-700">📊 Wastage by Reason</p>
                {wastageByReason.map(([reason, qty]) => {
                  const pct = totalWasted > 0 ? (qty / totalWasted) * 100 : 0;
                  return (
                    <div key={reason}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium">{reason}</span>
                        <span className="text-red-600 font-bold">{qty} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-red-100 rounded-full h-2">
                        <div className="bg-red-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By item */}
          {wastageByItem.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-red-700">🗑️ Wastage by Item</p>
                {wastageByItem.map(([item, data]) => {
                  const pct = (data.qty / maxWastageQty) * 100;
                  const reasonEntries = Object.entries(data.reasons) as [string, number][];
                  const topReason = reasonEntries.sort((a, b) => b[1] - a[1])[0];
                  const catCls = CATEGORY_COLOURS[data.category] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={item} className="border-l-2 border-red-300 pl-2">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{item}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catCls}`}>{data.category}</span>
                        </div>
                        <span className="text-red-600 font-bold">{data.qty}</span>
                      </div>
                      <div className="w-full bg-red-100 rounded-full h-1.5">
                        <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      {topReason && (
                        <p className="text-[10px] text-base-content/50 mt-0.5">Main reason: {topReason[0]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By category */}
          {wastageByCategory.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-red-700">📦 Wastage by Category</p>
                {wastageByCategory.map(([cat, data]) => {
                  const catCls = CATEGORY_COLOURS[cat] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${catCls}`}>{cat}</span>
                        <span className="text-base-content/50">{data.items.length} items</span>
                      </div>
                      <span className="font-bold text-red-600">{data.qty}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredWastage.length === 0 && (
            <div className="text-center py-8 text-base-content/40">
              <AlertTriangle size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No wastage recorded in this period</p>
              <p className="text-xs">That's actually good news! 🎉</p>
            </div>
          )}
        </>
      )}

      {/* Outwards breakdown */}
      {(reportType === 'outwards' || reportType === 'all') && (
        <>
          {outwardsByItem.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-blue-700">📤 Items Taken by Item</p>
                {outwardsByItem.map(([item, data]) => {
                  const pct = (data.qty / maxOutwardsQty) * 100;
                  const catCls = CATEGORY_COLOURS[data.category] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={item} className="border-l-2 border-blue-300 pl-2">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{item}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catCls}`}>{data.category}</span>
                        </div>
                        <span className="text-blue-600 font-bold">{data.qty}</span>
                      </div>
                      <div className="w-full bg-blue-100 rounded-full h-1.5">
                        <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-base-content/50 mt-0.5">{data.people.size} unique collector{data.people.size !== 1 ? 's' : ''}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredOutwards.length === 0 && (
            <div className="text-center py-8 text-base-content/40">
              <TrendingUp size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No outward entries in this period</p>
            </div>
          )}
        </>
      )}

      {/* Items in system - Full Report only */}
      {isFullReport && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-purple-700 flex items-center gap-1"><ListPlus size={12} /> Items in System</p>
              <span className="badge badge-sm badge-ghost">{customItems.length}</span>
            </div>
            {customItems.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {customItems.map(ci => {
                  const catCls = CATEGORY_COLOURS[ci.category] || 'bg-gray-100 text-gray-700';
                  return (
                    <span key={ci.id} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catCls}`}>
                      {ci.name}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-base-content/40">No custom items added yet</p>
            )}
          </div>
        </div>
      )}

      {/* Initials/Volunteers - Full Report only */}
      {isFullReport && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-700 flex items-center gap-1"><Users size={12} /> Initials / Volunteers in System</p>
              <span className="badge badge-sm badge-ghost">{allInitials.length}</span>
            </div>
            {allInitials.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {allInitials.map(name => (
                  <span key={name} className="text-[10px] px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 font-medium">
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-base-content/40">No initials recorded yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
