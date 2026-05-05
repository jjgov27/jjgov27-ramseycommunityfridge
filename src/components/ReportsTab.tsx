import React, { useState, useMemo } from 'react';
import { FileBarChart, Download, Calendar, Filter, TrendingUp, AlertTriangle, PackagePlus, Users, ListPlus, Database } from 'lucide-react';
import { WastageEntry, InwardItem, OutwardEntry, StorageLocation, CATEGORY_COLOURS, CustomItem, ArchivedRecord, Donor } from '../types';

interface Props {
  inwards: InwardItem[];
  wastage: WastageEntry[];
  outwards: OutwardEntry[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  archive: ArchivedRecord[];
  customItems: CustomItem[];
  donors: Donor[];
}

const parseDateStr = (d: string): Date | null => {
  if (!d) return null;
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [year, month, day] = d.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const textDate = new Date(d);
  if (!isNaN(textDate.getTime())) return textDate;
  return null;
};

const toISODate = (d: Date) => d.toISOString().split('T')[0];
const kgToLbs = (kg: number) => (kg * 2.20462).toFixed(1);

export const ReportsTab: React.FC<Props> = ({ inwards, wastage, outwards, storage, onStorageChange, archive, customItems, donors }) => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(toISODate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(toISODate(today));
  const [reportType, setReportType] = useState<'inwards' | 'wastage' | 'outwards' | 'all' | 'monthly'>('inwards');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const isFullReport = reportType === 'all';

  // Reconstruct archived data
  const archivedInwards = useMemo(() => archive.map(a => ({
    id: a.id, item: a.item, category: a.category, qty_in: a.qty_in, unit: a.unit,
    date_in: a.date_in, time_in: '', donor: a.donor, entered_by: '',
    best_before: a.best_before, storage: a.storage, moved_to: '', moved_date: '',
    qty_remaining: 0, total_taken: a.total_taken, total_wasted: a.total_wasted,
    status: 'gone' as const, _archived: true,
  })), [archive]);

  const archivedOutwards = useMemo(() => {
    const out: OutwardEntry[] = [];
    archive.forEach(a => {
      try {
        const entries = JSON.parse(a.outwards_json || '[]');
        entries.forEach((e: any) => {
          out.push({
            id: e.id || 0, inward_id: e.inward_id || a.id, item: a.item,
            category: a.category, storage: a.storage,
            qty_taken: e.qty_taken || 1, date_taken: e.date_taken || a.date_in,
            time_taken: e.time_taken || '', taken_by: e.taken_by || '',
            recorded_by: e.recorded_by || '', source: e.source || 'manual',
            donor: a.donor || '',
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
            id: e.id || 0, inward_id: e.inward_id || a.id, item: a.item,
            category: a.category, storage: a.storage,
            qty_wasted: e.qty_wasted || 1, reason: e.reason || 'Unknown',
            date_wasted: e.date_wasted || a.date_in, reported_by: e.reported_by || '',
            notes: e.notes || '', weight_kg: e.weight_kg || 0, donor: a.donor || '',
          });
        });
      } catch {}
    });
    return wast;
  }, [archive]);

  const allInwards = useMemo(() => isFullReport ? [...inwards, ...archivedInwards] : inwards, [isFullReport, inwards, archivedInwards]);
  const allOutwards = useMemo(() => isFullReport ? [...outwards, ...archivedOutwards] : outwards, [isFullReport, outwards, archivedOutwards]);
  const allWastage = useMemo(() => isFullReport ? [...wastage, ...archivedWastage] : wastage, [isFullReport, wastage, archivedWastage]);

  // Date filtering
  const filterByDate = <T extends Record<string, any>>(items: T[], dateField: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    return items.filter(i => {
      if (!isFullReport && i.storage !== storage) return false;
      const d = parseDateStr(i[dateField]);
      if (!d) return false;
      return d >= start && d <= end;
    });
  };

  const filteredInwards = useMemo(() => filterByDate(allInwards, 'date_in'), [allInwards, storage, startDate, endDate, isFullReport]);
  const filteredOutwards = useMemo(() => filterByDate(allOutwards, 'date_taken'), [allOutwards, storage, startDate, endDate, isFullReport]);
  const filteredWastage = useMemo(() => filterByDate(allWastage, 'date_wasted'), [allWastage, storage, startDate, endDate, isFullReport]);

  // Build lookup for outwards/wastage linked to inwards (to track time between in and out)
  const inwardLookup = useMemo(() => {
    const map: Record<string, InwardItem & { _archived?: boolean }> = {};
    allInwards.forEach(i => { map[i.id] = i; });
    return map;
  }, [allInwards]);

  // Stats
  const totalInQty = filteredInwards.reduce((s, i) => s + (i.qty_in || 0), 0);
  const totalTaken = filteredOutwards.reduce((s, o) => s + o.qty_taken, 0);
  const totalWasted = filteredWastage.reduce((s, w) => s + w.qty_wasted, 0);
  const totalWeightKg = filteredWastage.reduce((s, w) => s + (w.weight_kg || 0), 0);

  // Inwards groupings
  const inwardsByCategory = useMemo(() => {
    const map: Record<string, { qty: number; items: string[] }> = {};
    filteredInwards.forEach(i => {
      if (!map[i.category]) map[i.category] = { qty: 0, items: [] };
      map[i.category].qty += i.qty_in;
      if (!map[i.category].items.includes(i.item)) map[i.category].items.push(i.item);
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredInwards]);

  const inwardsByDonor = useMemo(() => {
    const map: Record<string, { qty: number; items: Set<string> }> = {};
    filteredInwards.forEach(i => {
      const donor = i.donor || 'Unknown';
      if (!map[donor]) map[donor] = { qty: 0, items: new Set() };
      map[donor].qty += i.qty_in;
      map[donor].items.add(i.item);
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredInwards]);

  // Wastage groupings
  const wastageByReason = useMemo(() => {
    const map: Record<string, number> = {};
    filteredWastage.forEach(w => { map[w.reason] = (map[w.reason] || 0) + w.qty_wasted; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredWastage]);

  const wastageByItem = useMemo(() => {
    const map: Record<string, { qty: number; category: string; weightKg: number }> = {};
    filteredWastage.forEach(w => {
      if (!map[w.item]) map[w.item] = { qty: 0, category: w.category, weightKg: 0 };
      map[w.item].qty += w.qty_wasted;
      map[w.item].weightKg += (w.weight_kg || 0);
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredWastage]);

  // Outwards groupings
  const outwardsByItem = useMemo(() => {
    const map: Record<string, { qty: number; category: string }> = {};
    filteredOutwards.forEach(o => {
      if (!map[o.item]) map[o.item] = { qty: 0, category: o.category };
      map[o.item].qty += o.qty_taken;
    });
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  }, [filteredOutwards]);

  // CSV Download
  const downloadCSV = () => {
    let csv = '';
    const storageLabel = isFullReport ? 'All (Fridge + Freezer)' : storage;

    if (reportType === 'inwards' || reportType === 'all') {
      csv += 'INWARD REPORT\n';
      csv += `Storage,${storageLabel}\n`;
      csv += `Period,${startDate} to ${endDate}\n`;
      if (isFullReport) csv += 'Includes,Live + Archived data\n';
      csv += '\n';
      csv += 'Date,Time,Item,Quantity,Unit,Category,Location,Moved To,Moved Date,Donor/Source,Volunteer,Best Before,Status\n';
      filteredInwards.forEach(i => {
        const status = i.qty_remaining <= 0 ? 'All Gone' : (i.total_taken > 0 || i.total_wasted > 0) ? 'Partial' : 'Available';
        csv += `"${i.date_in}","${i.time_in || ''}","${i.item}",${i.qty_in},"${i.unit}","${i.category}","${i.storage}","${i.moved_to || ''}","${i.moved_date || ''}","${i.donor || ''}","${i.entered_by || ''}","${i.best_before || ''}","${status}"\n`;
      });
      csv += `\nTotal Items In,,,${totalInQty}\nTotal Entries,,,${filteredInwards.length}\n\n`;

      csv += 'INWARDS BY CATEGORY\nCategory,Qty,Unique Items\n';
      inwardsByCategory.forEach(([cat, data]) => { csv += `"${cat}",${data.qty},${data.items.length}\n`; });
      csv += '\n';

      csv += 'INWARDS BY DONOR/SOURCE\nDonor/Source,Qty,Unique Items\n';
      inwardsByDonor.forEach(([donor, data]) => { csv += `"${donor}",${data.qty},${data.items.size}\n`; });
      csv += '\n';
    }

    if (reportType === 'outwards' || reportType === 'all') {
      csv += 'OUTWARD REPORT\n';
      csv += `Storage,${storageLabel}\n`;
      csv += `Period,${startDate} to ${endDate}\n\n`;
      csv += 'Date,Time,Item,Quantity,Donor/Source,Volunteer,Source Type,Days In Stock\n';
      filteredOutwards.forEach(o => {
        const inItem = inwardLookup[o.inward_id];
        let daysInStock = '';
        if (inItem) {
          const dIn = parseDateStr(inItem.date_in);
          const dOut = parseDateStr(o.date_taken);
          if (dIn && dOut) daysInStock = String(Math.round((dOut.getTime() - dIn.getTime()) / 86400000));
        }
        csv += `"${o.date_taken}","${o.time_taken}","${o.item}",${o.qty_taken},"${o.donor || ''}","${o.recorded_by || ''}","${o.source || 'manual'}","${daysInStock}"\n`;
      });
      csv += `\nTotal Taken,,,${totalTaken}\n\n`;
    }

    if (reportType === 'wastage' || reportType === 'all') {
      csv += 'WASTAGE REPORT\n';
      csv += `Storage,${storageLabel}\n`;
      csv += `Period,${startDate} to ${endDate}\n\n`;
      csv += 'Date,Time,Item,Quantity,Weight KG,Weight lbs,Reason,Donor/Source,Volunteer,Notes\n';
      filteredWastage.forEach(w => {
        const wkg = w.weight_kg || 0;
        csv += `"${w.date_wasted}","","${w.item}",${w.qty_wasted},${wkg},${wkg > 0 ? kgToLbs(wkg) : ''},"${w.reason}","${w.donor || ''}","${w.reported_by || ''}","${w.notes || ''}"\n`;
      });
      csv += `\nTotal Wasted,,,${totalWasted}\nTotal Weight (KG),,,${totalWeightKg.toFixed(1)}\nTotal Weight (lbs),,,${kgToLbs(totalWeightKg)}\n\n`;
    }

    if (reportType === 'all') {
      csv += 'ITEMS IN SYSTEM\nName,Category\n';
      customItems.forEach(ci => { csv += `"${ci.name}","${ci.category}"\n`; });
      csv += `\nTotal Items,${customItems.length}\n\n`;

      csv += 'DONORS / SOURCES IN SYSTEM\nName\n';
      donors.forEach(d => { csv += `"${d.name}"\n`; });
      csv += `\nTotal Donors,${donors.length}\n\n`;

      // Volunteer activity
      csv += 'VOLUNTEER ACTIVITY\nVolunteer,Items In,Qty In,Items Out,Qty Out,Waste Entries,Qty Wasted,Total Actions\n';
      const volCsvMap: Record<string, { inC: number; inQ: number; outC: number; outQ: number; wC: number; wQ: number }> = {};
      const ensureVol = (n: string) => { if (!volCsvMap[n]) volCsvMap[n] = { inC: 0, inQ: 0, outC: 0, outQ: 0, wC: 0, wQ: 0 }; return volCsvMap[n]; };
      filteredInwards.forEach(i => { const v = ensureVol(i.entered_by || '?'); v.inC++; v.inQ += i.qty_in; });
      filteredOutwards.forEach(o => { const v = ensureVol(o.recorded_by || '?'); v.outC++; v.outQ += o.qty_taken; });
      filteredWastage.forEach(w => { const v = ensureVol(w.reported_by || '?'); v.wC++; v.wQ += w.qty_wasted; });
      Object.entries(volCsvMap).forEach(([name, d]) => {
        csv += `"${name}",${d.inC},${d.inQ},${d.outC},${d.outQ},${d.wC},${d.wQ},${d.inC + d.outC + d.wC}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `community-fridge-${reportType}-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Storage toggle - hidden for Full Report */}
      {!isFullReport && (
        <div className="flex items-center gap-2">
          <button className={`btn btn-xs ${storage === 'fridge' ? 'btn-success' : 'btn-ghost'}`} onClick={() => onStorageChange('fridge')}>🧊 Fridge</button>
          <button className={`btn btn-xs ${storage === 'freezer' ? 'btn-info' : 'btn-ghost'}`} onClick={() => onStorageChange('freezer')}>❄️ Freezer</button>
        </div>
      )}

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
            {reportType !== 'monthly' && (
              <>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs font-medium text-violet-700 flex items-center gap-1 mb-1"><Calendar size={10} /> From</label>
                  <input type="date" className="input input-bordered input-xs w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs font-medium text-violet-700 flex items-center gap-1 mb-1"><Calendar size={10} /> To</label>
                  <input type="date" className="input input-bordered input-xs w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </>
            )}
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-medium text-violet-700 flex items-center gap-1 mb-1"><Filter size={10} /> Type</label>
              <select className="select select-bordered select-xs w-full" value={reportType} onChange={e => setReportType(e.target.value as any)}>
                <option value="inwards">📥 Inwards Only</option>
                <option value="outwards">📤 Outwards Only</option>
                <option value="wastage">🗑️ Wastage Only</option>
                <option value="all">📊 Full Report (All)</option>
                <option value="monthly">🥧 Monthly Pie Charts</option>
              </select>
            </div>
          </div>

          {reportType !== 'monthly' && (
            <button className="btn btn-xs btn-primary gap-1" onClick={downloadCSV}>
              <Download size={12} /> Download CSV
            </button>
          )}
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
        {(reportType === 'wastage' || reportType === 'all') && (
          <div className="card bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
            <div className="card-body p-3 text-center">
              <AlertTriangle size={16} className="text-red-500 mx-auto" />
              <p className="text-2xl font-bold text-red-700">{totalWasted}</p>
              <p className="text-xs text-red-500">Total Wasted</p>
              {totalWeightKg > 0 && <p className="text-xs text-red-400">⚖️ {totalWeightKg.toFixed(1)}kg / {kgToLbs(totalWeightKg)}lbs</p>}
            </div>
          </div>
        )}
      </div>

      {/* ===== INWARD REPORT — line-by-line table ===== */}
      {(reportType === 'inwards' || reportType === 'all') && (
        <>
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-3 space-y-2">
              <p className="text-xs font-bold text-green-700">📥 Inward Report — Line by Line</p>
              {filteredInwards.length === 0 ? (
                <p className="text-xs text-base-content/40 text-center py-4">No inward entries in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-xs w-full">
                    <thead>
                      <tr className="text-[10px]">
                        <th>Date</th><th>Time</th><th>Item</th><th>Qty</th><th>Location</th>
                        <th>Moved To</th><th>Moved Date</th><th>Donor</th><th>Volunteer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInwards.map(i => (
                        <tr key={i.id} className="text-[10px]">
                          <td>{i.date_in}</td>
                          <td>{i.time_in || '-'}</td>
                          <td className="font-medium">{i.item}</td>
                          <td>{i.qty_in} {i.unit}</td>
                          <td>{i.storage === 'fridge' ? '🧊 Fridge' : '❄️ Freezer'}</td>
                          <td>{i.moved_to ? (i.moved_to === 'fridge' ? '🧊 Fridge' : '❄️ Freezer') : '-'}</td>
                          <td>{i.moved_date || '-'}</td>
                          <td>{i.donor || '-'}</td>
                          <td>{i.entered_by || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

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

          {/* By donor */}
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
        </>
      )}

      {/* ===== OUTWARD REPORT — line-by-line table ===== */}
      {(reportType === 'outwards' || reportType === 'all') && (
        <>
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-3 space-y-2">
              <p className="text-xs font-bold text-blue-700">📤 Outward Report — Line by Line</p>
              {filteredOutwards.length === 0 ? (
                <p className="text-xs text-base-content/40 text-center py-4">No outward entries in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-xs w-full">
                    <thead>
                      <tr className="text-[10px]">
                        <th>Date</th><th>Time</th><th>Item</th><th>Qty</th>
                        <th>Donor</th><th>Volunteer</th><th>Source</th><th>Days In</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOutwards.map((o, idx) => {
                        const inItem = inwardLookup[o.inward_id];
                        let daysInStock = '-';
                        if (inItem) {
                          const dIn = parseDateStr(inItem.date_in);
                          const dOut = parseDateStr(o.date_taken);
                          if (dIn && dOut) daysInStock = String(Math.round((dOut.getTime() - dIn.getTime()) / 86400000));
                        }
                        return (
                          <tr key={`${o.id}-${idx}`} className="text-[10px]">
                            <td>{o.date_taken}</td>
                            <td>{o.time_taken || '-'}</td>
                            <td className="font-medium">{o.item}</td>
                            <td>{o.qty_taken}</td>
                            <td>{o.donor || '-'}</td>
                            <td>{o.recorded_by || '-'}</td>
                            <td>
                              {(o.source || 'manual') === 'manual' && <span className="badge badge-xs bg-green-100 text-green-700 border-green-200">✋ Manual</span>}
                              {o.source === 'import' && <span className="badge badge-xs bg-amber-100 text-amber-700 border-amber-200">📥 Import</span>}
                              {o.source === 'bulk' && <span className="badge badge-xs bg-purple-100 text-purple-700 border-purple-200">⚡ Bulk</span>}
                            </td>
                            <td>{daysInStock}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Outwards source breakdown */}
          {filteredOutwards.length > 0 && (() => {
            const manual = filteredOutwards.filter(o => !o.source || o.source === 'manual');
            const imported = filteredOutwards.filter(o => o.source === 'import');
            const bulk = filteredOutwards.filter(o => o.source === 'bulk');
            const manualQty = manual.reduce((s, o) => s + o.qty_taken, 0);
            const importQty = imported.reduce((s, o) => s + o.qty_taken, 0);
            const bulkQty = bulk.reduce((s, o) => s + o.qty_taken, 0);
            return (
              <div className="card bg-base-100 border border-base-300 shadow-sm">
                <div className="card-body p-3 space-y-2">
                  <p className="text-xs font-bold text-blue-700">📊 Outwards by Source Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
                      <div className="text-lg font-bold text-green-700">{manualQty}</div>
                      <div className="text-[10px] text-green-600">✋ Manual ({manual.length} entries)</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-200">
                      <div className="text-lg font-bold text-amber-700">{importQty}</div>
                      <div className="text-[10px] text-amber-600">📥 Import ({imported.length} entries)</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-200">
                      <div className="text-lg font-bold text-purple-700">{bulkQty}</div>
                      <div className="text-[10px] text-purple-600">⚡ Bulk ({bulk.length} entries)</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Outwards by item chart */}
          {outwardsByItem.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-blue-700">📤 Outwards by Item</p>
                {outwardsByItem.map(([item, data]) => {
                  const pct = totalTaken > 0 ? (data.qty / totalTaken) * 100 : 0;
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== WASTAGE REPORT — line-by-line table ===== */}
      {(reportType === 'wastage' || reportType === 'all') && (
        <>
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-3 space-y-2">
              <p className="text-xs font-bold text-red-700">🗑️ Wastage Report — Line by Line</p>
              {filteredWastage.length === 0 ? (
                <p className="text-xs text-base-content/40 text-center py-4">No wastage in this period — that's great! 🎉</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-xs w-full">
                    <thead>
                      <tr className="text-[10px]">
                        <th>Date</th><th>Item</th><th>Qty</th>
                        <th>Weight KG</th><th>Weight lbs</th>
                        <th>Reason</th><th>Donor</th><th>Volunteer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWastage.map((w, idx) => (
                        <tr key={`${w.id}-${idx}`} className="text-[10px]">
                          <td>{w.date_wasted}</td>
                          <td className="font-medium">{w.item}</td>
                          <td>{w.qty_wasted}</td>
                          <td>{w.weight_kg > 0 ? w.weight_kg.toFixed(1) : '-'}</td>
                          <td>{w.weight_kg > 0 ? kgToLbs(w.weight_kg) : '-'}</td>
                          <td>{w.reason}</td>
                          <td>{w.donor || '-'}</td>
                          <td>{w.reported_by || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Wastage by reason */}
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

          {/* Wastage by item */}
          {wastageByItem.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-red-700">🗑️ Wastage by Item</p>
                {wastageByItem.map(([item, data]) => {
                  const catCls = CATEGORY_COLOURS[data.category] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={item} className="flex items-center justify-between text-xs border-l-2 border-red-300 pl-2 py-0.5">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{item}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catCls}`}>{data.category}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-red-600">{data.qty}</span>
                        {data.weightKg > 0 && <span className="text-[10px] text-red-400 ml-1">({data.weightKg.toFixed(1)}kg)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 📉 Wastage Trends — by week and category */}
      {(reportType === 'wastage' || reportType === 'all') && filteredWastage.length > 0 && (() => {
        // Group wastage by week
        const weekMap: Record<string, { total: number; weightKg: number; cats: Record<string, number> }> = {};
        filteredWastage.forEach(w => {
          const d = parseDateStr(w.date_wasted);
          if (!d) return;
          const weekStart = new Date(d);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const wk = `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;
          if (!weekMap[wk]) weekMap[wk] = { total: 0, weightKg: 0, cats: {} };
          weekMap[wk].total += w.qty_wasted;
          weekMap[wk].weightKg += (w.weight_kg || 0);
          weekMap[wk].cats[w.category] = (weekMap[wk].cats[w.category] || 0) + w.qty_wasted;
        });
        const weeks = Object.entries(weekMap);
        const maxWeekQty = Math.max(...weeks.map(([, d]) => d.total), 1);

        // Category trend
        const catTrend: Record<string, number> = {};
        filteredWastage.forEach(w => { catTrend[w.category] = (catTrend[w.category] || 0) + w.qty_wasted; });
        const catEntries = Object.entries(catTrend).sort((a, b) => b[1] - a[1]);
        const maxCatQty = Math.max(...catEntries.map(([, q]) => q), 1);

        return (
          <>
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-red-700">📉 Wastage Trend by Week</p>
                {weeks.length === 0 ? (
                  <p className="text-xs text-base-content/40">Not enough data</p>
                ) : (
                  <div className="space-y-1">
                    {weeks.map(([wk, data]) => (
                      <div key={wk} className="flex items-center gap-2 text-xs">
                        <span className="w-12 text-right font-mono text-[10px] text-base-content/50">w/{wk}</span>
                        <div className="flex-1 bg-red-50 rounded-full h-4 relative overflow-hidden">
                          <div className="bg-gradient-to-r from-red-300 to-red-500 h-4 rounded-full transition-all flex items-center justify-end pr-1" style={{ width: `${(data.total / maxWeekQty) * 100}%` }}>
                            <span className="text-[9px] text-white font-bold">{data.total}</span>
                          </div>
                        </div>
                        {data.weightKg > 0 && <span className="text-[10px] text-red-400">{data.weightKg.toFixed(1)}kg</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-red-700">📊 Wastage by Category — Where Are We Losing?</p>
                <div className="space-y-1">
                  {catEntries.map(([cat, qty]) => {
                    const pct = (qty / maxCatQty) * 100;
                    const catCls = CATEGORY_COLOURS[cat] || 'bg-gray-100 text-gray-700';
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catCls}`}>{cat}</span>
                          <span className="font-bold text-red-600">{qty} items ({totalWasted > 0 ? ((qty / totalWasted) * 100).toFixed(0) : 0}%)</span>
                        </div>
                        <div className="w-full bg-red-50 rounded-full h-2">
                          <div className="bg-red-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* 👥 Volunteer Activity Report */}
      {/* ===== MONTHLY PIE CHARTS ===== */}
      {reportType === 'monthly' && (() => {
        // Get all months available
        const allItems = [...inwards, ...archivedInwards];
        const monthlyItems = allItems.filter(i => {
          const d = parseDateStr(i.date_in);
          if (!d) return false;
          const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return m === selectedMonth;
        });

        const monthLabel = (() => {
          const [y, m] = selectedMonth.split('-');
          const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          return `${months[Number(m) - 1]} ${y}`;
        })();

        // Aggregate by donor
        const donorTotals: Record<string, number> = {};
        monthlyItems.forEach(i => {
          const d = i.donor || 'Unknown';
          donorTotals[d] = (donorTotals[d] || 0) + i.qty_in;
        });
        const donorData = Object.entries(donorTotals).sort((a, b) => b[1] - a[1]);
        const donorTotal = donorData.reduce((s, [, v]) => s + v, 0);

        // Aggregate by category
        const catTotals: Record<string, number> = {};
        monthlyItems.forEach(i => {
          const c = i.category || 'Unknown';
          catTotals[c] = (catTotals[c] || 0) + i.qty_in;
        });
        const catData = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
        const catTotal = catData.reduce((s, [, v]) => s + v, 0);

        // Pie chart colours
        const PIE_COLOURS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16','#d946ef','#0ea5e9'];
        const CAT_PIE_COLOURS: Record<string, string> = {
          'Meat': '#ef4444', 'Dairy': '#3b82f6', 'Bakery': '#f59e0b', 'Vegetables': '#10b981',
          'Ready Meals': '#8b5cf6', 'Fruit': '#84cc16', 'Condiments': '#eab308', 'Chilled': '#06b6d4', 'Unknown': '#9ca3af'
        };

        // SVG pie chart renderer
        const renderPie = (data: [string, number][], total: number, colours: (i: number, label: string) => string) => {
          if (total === 0) return <p className="text-sm text-base-content/50 text-center py-8">No data for this month</p>;
          const size = 200;
          const cx = size / 2, cy = size / 2, r = 80;
          let cumAngle = -Math.PI / 2;

          const slices = data.map(([label, value], idx) => {
            const angle = (value / total) * Math.PI * 2;
            const x1 = cx + r * Math.cos(cumAngle);
            const y1 = cy + r * Math.sin(cumAngle);
            const x2 = cx + r * Math.cos(cumAngle + angle);
            const y2 = cy + r * Math.sin(cumAngle + angle);
            const largeArc = angle > Math.PI ? 1 : 0;
            const pathD = value === total
              ? `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx - 0.001},${cy - r} Z`
              : `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
            const colour = colours(idx, label);
            cumAngle += angle;
            return <path key={label} d={pathD} fill={colour} stroke="white" strokeWidth="2" />;
          });

          return (
            <div className="flex flex-col items-center gap-3">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{slices}</svg>
              <div className="flex flex-wrap gap-2 justify-center">
                {data.map(([label, value], idx) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colours(idx, label) }} />
                    <span className="font-medium">{label}</span>
                    <span className="text-base-content/50">({value} — {((value / total) * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          );
        };

        // Get available months for selector
        const availableMonths = [...new Set(allItems.map(i => {
          const d = parseDateStr(i.date_in);
          if (!d) return null;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }).filter(Boolean) as string[])].sort().reverse();

        return (
          <div className="space-y-4 print-section" id="monthly-charts">
            {/* Month selector */}
            <div className="card bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 shadow-sm">
              <div className="card-body p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🥧</span>
                    <span className="font-bold text-sm text-indigo-800">Monthly Summary — {monthLabel}</span>
                    <span className="badge badge-sm badge-primary">{monthlyItems.length} items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="select select-bordered select-xs" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                      {availableMonths.map(m => {
                        const [y, mo] = m.split('-');
                        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        return <option key={m} value={m}>{months[Number(mo) - 1]} {y}</option>;
                      })}
                    </select>
                    <button className="btn btn-xs btn-outline gap-1" onClick={() => window.print()}>🖨️ Print</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="card bg-blue-50 border border-blue-200 p-3 text-center">
                <p className="text-2xl font-black text-blue-700">{donorTotal}</p>
                <p className="text-[10px] text-blue-600 font-medium">Total Items In</p>
              </div>
              <div className="card bg-green-50 border border-green-200 p-3 text-center">
                <p className="text-2xl font-black text-green-700">{donorData.length}</p>
                <p className="text-[10px] text-green-600 font-medium">Donors Active</p>
              </div>
              <div className="card bg-purple-50 border border-purple-200 p-3 text-center">
                <p className="text-2xl font-black text-purple-700">{catData.length}</p>
                <p className="text-[10px] text-purple-600 font-medium">Categories</p>
              </div>
              <div className="card bg-amber-50 border border-amber-200 p-3 text-center">
                <p className="text-2xl font-black text-amber-700">{monthlyItems.length}</p>
                <p className="text-[10px] text-amber-600 font-medium">Deliveries</p>
              </div>
            </div>

            {/* Donor Pie Chart */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏪</span>
                  <span className="font-bold text-sm">Items by Donor</span>
                  <span className="badge badge-xs badge-ghost">{donorTotal} total</span>
                </div>
                {renderPie(donorData, donorTotal, (i) => PIE_COLOURS[i % PIE_COLOURS.length])}
              </div>
            </div>

            {/* Category Pie Chart */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  <span className="font-bold text-sm">Items by Category</span>
                  <span className="badge badge-xs badge-ghost">{catTotal} total</span>
                </div>
                {renderPie(catData, catTotal, (_, label) => CAT_PIE_COLOURS[label] || '#9ca3af')}
              </div>
            </div>

            {/* Donor Table */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="font-bold text-xs text-indigo-700">📋 Donor Breakdown — {monthLabel}</p>
                <div className="overflow-x-auto">
                  <table className="table table-xs w-full">
                    <thead><tr className="bg-indigo-50"><th>Donor</th><th className="text-right">Qty</th><th className="text-right">%</th><th>Items</th></tr></thead>
                    <tbody>
                      {donorData.map(([donor, qty]) => (
                        <tr key={donor} className="hover">
                          <td className="font-medium text-xs">{donor}</td>
                          <td className="text-right text-xs font-bold">{qty}</td>
                          <td className="text-right text-xs text-base-content/60">{((qty / donorTotal) * 100).toFixed(0)}%</td>
                          <td className="text-[10px] text-base-content/50">{monthlyItems.filter(i => (i.donor || 'Unknown') === donor).map(i => i.item).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Category Table */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="font-bold text-xs text-emerald-700">📋 Category Breakdown — {monthLabel}</p>
                <div className="overflow-x-auto">
                  <table className="table table-xs w-full">
                    <thead><tr className="bg-emerald-50"><th>Category</th><th className="text-right">Qty</th><th className="text-right">%</th><th>Items</th></tr></thead>
                    <tbody>
                      {catData.map(([cat, qty]) => (
                        <tr key={cat} className="hover">
                          <td className="text-xs"><span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold" style={{ backgroundColor: CAT_PIE_COLOURS[cat] || '#9ca3af' }}>{cat}</span></td>
                          <td className="text-right text-xs font-bold">{qty}</td>
                          <td className="text-right text-xs text-base-content/60">{((qty / catTotal) * 100).toFixed(0)}%</td>
                          <td className="text-[10px] text-base-content/50">{monthlyItems.filter(i => (i.category || 'Unknown') === cat).map(i => i.item).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {(reportType === 'all') && (() => {
        const volMap: Record<string, { inQty: number; inCount: number; outQty: number; outCount: number; wasteQty: number; wasteCount: number }> = {};
        const addVol = (name: string) => {
          if (!volMap[name]) volMap[name] = { inQty: 0, inCount: 0, outQty: 0, outCount: 0, wasteQty: 0, wasteCount: 0 };
          return volMap[name];
        };
        filteredInwards.forEach(i => { const v = addVol(i.entered_by || '?'); v.inCount++; v.inQty += i.qty_in; });
        filteredOutwards.forEach(o => { const v = addVol(o.recorded_by || '?'); v.outCount++; v.outQty += o.qty_taken; });
        filteredWastage.forEach(w => { const v = addVol(w.reported_by || '?'); v.wasteCount++; v.wasteQty += w.qty_wasted; });
        const vols = Object.entries(volMap).sort((a, b) => (b[1].inCount + b[1].outCount + b[1].wasteCount) - (a[1].inCount + a[1].outCount + a[1].wasteCount));
        if (vols.length === 0) return null;
        return (
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-3 space-y-2">
              <p className="text-xs font-bold text-violet-700">👥 Volunteer Activity Report</p>
              <div className="overflow-x-auto">
                <table className="table table-xs w-full">
                  <thead>
                    <tr className="text-[10px]">
                      <th>Volunteer</th>
                      <th className="text-center">📥 Items In</th><th className="text-center">Qty In</th>
                      <th className="text-center">📤 Items Out</th><th className="text-center">Qty Out</th>
                      <th className="text-center">🗑️ Waste</th><th className="text-center">Qty Waste</th>
                      <th className="text-center">Total Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vols.map(([name, d]) => (
                      <tr key={name} className="text-[10px]">
                        <td className="font-medium">{name}</td>
                        <td className="text-center">{d.inCount}</td><td className="text-center font-bold text-green-600">{d.inQty}</td>
                        <td className="text-center">{d.outCount}</td><td className="text-center font-bold text-blue-600">{d.outQty}</td>
                        <td className="text-center">{d.wasteCount}</td><td className="text-center font-bold text-red-600">{d.wasteQty}</td>
                        <td className="text-center font-bold">{d.inCount + d.outCount + d.wasteCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full report extras */}
      {isFullReport && (
        <>
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
                    return <span key={ci.id} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catCls}`}>{ci.name}</span>;
                  })}
                </div>
              ) : <p className="text-xs text-base-content/40">No custom items added yet</p>}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-orange-700 flex items-center gap-1">🏪 Donors / Sources</p>
                <span className="badge badge-sm badge-ghost">{donors.length}</span>
              </div>
              {donors.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {donors.map(d => (
                    <span key={d.id} className="text-[10px] px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200 font-medium">{d.name}</span>
                  ))}
                </div>
              ) : <p className="text-xs text-base-content/40">No donors added yet</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
