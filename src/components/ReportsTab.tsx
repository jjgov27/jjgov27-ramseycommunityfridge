import React, { useState, useMemo } from 'react';
import { FileBarChart, Download, Calendar, Filter, TrendingUp, AlertTriangle, PackagePlus, Users, ListPlus, Database } from 'lucide-react';
import { WastageEntry, InwardItem, OutwardEntry, StorageLocation, CATEGORY_COLOURS, CustomItem, ArchivedRecord, Donor, CustomCategory, getAllCategories, getCategoryHexColour } from '../types';

interface Props {
  inwards: InwardItem[];
  wastage: WastageEntry[];
  outwards: OutwardEntry[];
  storage: StorageLocation;
  onStorageChange: (s: StorageLocation) => void;
  archive: ArchivedRecord[];
  customItems: CustomItem[];
  donors: Donor[];
  customCategories: CustomCategory[];
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
const isMeat = (category: string) => category === 'Meat';

export const ReportsTab: React.FC<Props> = ({ inwards, wastage, outwards, storage, onStorageChange, archive, customItems, donors, customCategories }) => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(toISODate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(toISODate(today));
  const [reportType, setReportType] = useState<'inwards' | 'wastage' | 'outwards' | 'all' | 'monthly' | 'custom' | 'stockcheck' | 'donor'>('inwards');
  const [selectedDonor, setSelectedDonor] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  // Custom report state
  const [customMonths, setCustomMonths] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<Record<string, boolean>>({
    inwardsSummary: true, outwardsSummary: true, wastageSummary: true,
    donorBreakdown: true, categoryBreakdown: true, volunteerActivity: true, pieCharts: true,
  });

  // Category filter state
  const [catFilterMode, setCatFilterMode] = useState<'include' | 'exclude'>('include');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [catFilterOpen, setCatFilterOpen] = useState(false);

  const isFullReport = reportType === 'all' || reportType === 'custom' || reportType === 'donor';

  // Reconstruct archived data
  const archivedInwards = useMemo(() => archive.map(a => ({
    id: a.id, item: a.item, category: a.category, qty_in: a.qty_in, unit: a.unit,
    date_in: a.date_in, time_in: '', donor: a.donor, entered_by: '',
    best_before: a.best_before, storage: a.storage, moved_to: '', moved_date: '',
    unit_value: a.unit_value || 0,
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

  const dateFilteredInwards = useMemo(() => filterByDate(allInwards, 'date_in'), [allInwards, storage, startDate, endDate, isFullReport]);
  const dateFilteredOutwards = useMemo(() => filterByDate(allOutwards, 'date_taken'), [allOutwards, storage, startDate, endDate, isFullReport]);
  const dateFilteredWastage = useMemo(() => filterByDate(allWastage, 'date_wasted'), [allWastage, storage, startDate, endDate, isFullReport]);

  // All known categories plus those present in the date-filtered data
  const allCategories = useMemo(() => {
    const cats = new Set<string>(getAllCategories(customCategories));
    dateFilteredInwards.forEach(i => cats.add(i.category));
    dateFilteredOutwards.forEach(o => cats.add(o.category));
    dateFilteredWastage.forEach(w => cats.add(w.category));
    return [...cats].sort();
  }, [dateFilteredInwards, dateFilteredOutwards, dateFilteredWastage, customCategories]);

  // Category filter helper
  const catPassesFilter = (category: string) => {
    if (selectedCats.size === 0) return true; // no filter active
    if (catFilterMode === 'include') return selectedCats.has(category);
    return !selectedCats.has(category); // exclude mode
  };

  // Apply category filter on top of date filter
  const filteredInwards = useMemo(() => dateFilteredInwards.filter(i => catPassesFilter(i.category)), [dateFilteredInwards, selectedCats, catFilterMode]);
  const filteredOutwards = useMemo(() => dateFilteredOutwards.filter(o => catPassesFilter(o.category)), [dateFilteredOutwards, selectedCats, catFilterMode]);
  const filteredWastage = useMemo(() => dateFilteredWastage.filter(w => catPassesFilter(w.category)), [dateFilteredWastage, selectedCats, catFilterMode]);

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
      csv += 'Date,Time,Item,Quantity,Unit,Category,Location,Moved To,Moved Date,Donor/Source,Volunteer,Use By,Best Before,Value (£),Total Value (£),Status\n';
      filteredInwards.forEach(i => {
        const status = i.qty_remaining <= 0 ? 'All Gone' : (i.total_taken > 0 || i.total_wasted > 0) ? 'Partial' : 'Available';
        const uv = i.unit_value || 0;
        const totalVal = uv * i.qty_in;
        csv += `"${i.date_in}","${i.time_in || ''}","${i.item}",${i.qty_in},"${i.unit}","${i.category}","${i.storage}","${i.moved_to || ''}","${i.moved_date || ''}","${i.donor || ''}","${i.entered_by || ''}","${isMeat(i.category) ? i.best_before || '' : '-'}","${isMeat(i.category) ? '-' : i.best_before || ''}",${uv > 0 ? uv.toFixed(2) : ''},${totalVal > 0 ? totalVal.toFixed(2) : ''},"${status}"\n`;
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
      {!isFullReport && reportType !== 'custom' && reportType !== 'stockcheck' && (
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
            {reportType !== 'monthly' && reportType !== 'custom' && reportType !== 'stockcheck' && (
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
                <option value="donor">🏢 Donor Report</option>
                <option value="monthly">🥧 Monthly Pie Charts</option>
                <option value="custom">📋 Custom Report Builder</option>
                <option value="stockcheck">📋 Stock Check</option>
              </select>
            </div>
            {reportType === 'donor' && (
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-violet-700 flex items-center gap-1 mb-1"><Users size={10} /> Donor</label>
                <select className="select select-bordered select-xs w-full" value={selectedDonor} onChange={e => setSelectedDonor(e.target.value)}>
                  <option value="">Select a donor...</option>
                  {[...donors].sort((a, b) => a.name.localeCompare(b.name)).map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {reportType !== 'monthly' && reportType !== 'custom' && reportType !== 'stockcheck' && reportType !== 'donor' && (
              <button className="btn btn-xs btn-primary gap-1" onClick={downloadCSV}>
                <Download size={12} /> Download CSV
              </button>
            )}
            {reportType !== 'monthly' && reportType !== 'custom' && reportType !== 'stockcheck' && (
              <button
                className={`btn btn-xs gap-1 ${selectedCats.size > 0 ? 'btn-warning' : 'btn-ghost border-violet-300'}`}
                onClick={() => setCatFilterOpen(!catFilterOpen)}
              >
                <Filter size={12} /> Categories {selectedCats.size > 0 ? `(${selectedCats.size} ${catFilterMode === 'include' ? 'included' : 'excluded'})` : ''}
              </button>
            )}
          </div>

          {/* Category filter panel */}
          {catFilterOpen && reportType !== 'monthly' && reportType !== 'custom' && reportType !== 'stockcheck' && (
            <div className="bg-white border border-violet-200 rounded-lg p-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-violet-700">Mode:</span>
                <button
                  className={`btn btn-xs ${catFilterMode === 'include' ? 'btn-success' : 'btn-ghost border-gray-300'}`}
                  onClick={() => setCatFilterMode('include')}
                >✅ Include</button>
                <button
                  className={`btn btn-xs ${catFilterMode === 'exclude' ? 'btn-error' : 'btn-ghost border-gray-300'}`}
                  onClick={() => setCatFilterMode('exclude')}
                >❌ Exclude</button>
                <span className="text-xs text-gray-500 italic ml-1">
                  {catFilterMode === 'include'
                    ? 'Only ticked categories shown'
                    : 'Ticked categories hidden'}
                </span>
                <button
                  className="btn btn-xs btn-ghost text-violet-600 ml-auto"
                  onClick={() => setSelectedCats(new Set(allCategories))}
                >Select All</button>
                <button
                  className="btn btn-xs btn-ghost text-violet-600"
                  onClick={() => setSelectedCats(new Set())}
                >Clear All</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {allCategories.map(cat => {
                  const colour = getCategoryHexColour(cat, customCategories);
                  const isSelected = selectedCats.has(cat);
                  return (
                    <label
                      key={cat}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer border transition-all ${
                        isSelected
                          ? 'bg-opacity-20 border-current font-semibold'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}
                      style={isSelected ? { color: colour, backgroundColor: colour + '22', borderColor: colour } : {}}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={isSelected}
                        onChange={() => {
                          const next = new Set(selectedCats);
                          if (next.has(cat)) next.delete(cat); else next.add(cat);
                          setSelectedCats(next);
                        }}
                      />
                      {cat}
                    </label>
                  );
                })}
              </div>
              {selectedCats.size > 0 && (
                <p className="text-xs text-gray-500">
                  {catFilterMode === 'include'
                    ? `Showing: ${[...selectedCats].sort().join(', ')}`
                    : `Hiding: ${[...selectedCats].sort().join(', ')}`}
                </p>
              )}
            </div>
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
              {(() => { const tv = filteredInwards.reduce((s, i) => s + (i.unit_value || 0) * i.qty_in, 0); return tv > 0 ? <p className="text-xs text-green-600 font-semibold">💷 £{tv.toFixed(2)}</p> : null; })()}
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
                        <th>Moved To</th><th>Moved Date</th><th>Donor</th><th>Volunteer</th><th>Use By</th><th>Best Before</th><th>Value (£)</th>
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
                          <td>{isMeat(i.category) ? i.best_before || '-' : '-'}</td>
                          <td>{isMeat(i.category) ? '-' : i.best_before || '-'}</td>
                          <td>{i.unit_value > 0 ? `£${i.unit_value.toFixed(2)}` : '-'}</td>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{slices}</svg>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
                {data.map(([label, value], idx) => (
                  <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', marginRight: '6px' }}>
                    <span style={{ color: colours(idx, label), fontSize: '18px', lineHeight: '1' }}>■</span>
                    <span style={{ fontWeight: 600 }}>{label}:</span>
                    <span style={{ color: '#64748b' }}>{value} ({((value / total) * 100).toFixed(0)}%)</span>
                  </span>
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
                    <button className="btn btn-xs btn-outline gap-1" onClick={() => {
                      const el = document.getElementById('monthly-charts');
                      if (!el) return;
                      const html = `<!DOCTYPE html><html><head><title>Monthly Summary — ${monthLabel}</title>
                        <style>body{font-family:system-ui,sans-serif;padding:24px;color:#1e293b}
                        .card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;page-break-inside:avoid}
                        .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}
                        table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:left}
                        th{background:#f1f5f9;font-weight:600}svg{max-width:100%;display:block;margin:0 auto}
                        h2,h3{margin:8px 0}select{display:none}
                        .flex{display:flex}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.justify-center{justify-content:center}
                        .gap-1\\.5{gap:6px}.gap-2{gap:8px}.gap-3{gap:12px}
                        .text-xs{font-size:12px}.text-sm{font-size:14px}.font-medium{font-weight:500}.font-bold{font-weight:700}.font-black{font-weight:900}
                        .text-center{text-align:center}.space-y-3>*+*{margin-top:12px}
                        .grid{display:grid}.grid-cols-2{grid-template-columns:repeat(2,1fr)}.grid-cols-4{grid-template-columns:repeat(4,1fr)}
                        .p-3{padding:12px}.p-4{padding:16px}.text-2xl{font-size:24px}.text-lg{font-size:18px}
                        .text-\\[10px\\]{font-size:10px}
                        .bg-blue-50{background:#eff6ff}.bg-green-50{background:#f0fdf4}.bg-purple-50{background:#faf5ff}.bg-amber-50{background:#fffbeb}
                        .text-blue-700{color:#1d4ed8}.text-green-700{color:#15803d}.text-purple-700{color:#7e22ce}.text-amber-700{color:#b45309}
                        .text-blue-600{color:#2563eb}.text-green-600{color:#16a34a}.text-purple-600{color:#9333ea}.text-amber-600{color:#d97706}
                        .border{border:1px solid}.border-blue-200{border-color:#bfdbfe}.border-green-200{border-color:#bbf7d0}.border-purple-200{border-color:#e9d5ff}.border-amber-200{border-color:#fde68a}
                        .text-base-content\\/50{color:#64748b}
                        </style></head><body>${el.innerHTML}</body></html>`;
                      const blob = new Blob([html], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = 'monthly-report-' + monthLabel.replace(/\\s+/g,'-') + '.html';
                      a.click(); URL.revokeObjectURL(url);
                    }}>🖨️ Full Report</button>
                    <button className="btn btn-xs btn-secondary gap-1" onClick={() => {
                      const el = document.getElementById('pie-charts-only');
                      if (!el) return;
                      const html = `<!DOCTYPE html><html><head><title>Pie Charts — ${monthLabel}</title>
                        <style>body{font-family:system-ui,sans-serif;padding:24px;color:#1e293b;max-width:800px;margin:0 auto}
                        h1{font-size:22px;color:#16a34a;margin-bottom:4px;text-align:center}
                        p.sub{text-align:center;color:#64748b;font-size:12px;margin-bottom:20px}
                        .chart-container{display:flex;flex-wrap:wrap;gap:40px;justify-content:center;margin-top:20px}
                        .chart-box{flex:1;min-width:300px;max-width:380px;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center}
                        .chart-title{font-size:16px;font-weight:700;margin-bottom:12px}
                        svg{max-width:220px;display:block;margin:0 auto 12px}
                        @media print{body{padding:10px}}</style></head><body>
                        <h1>🥧 Ramsey Community Fridge — Pie Charts</h1>
                        <p class="sub">${monthLabel} | Generated: ${new Date().toLocaleDateString('en-GB')}</p>
                        <div class="chart-container">${el.innerHTML}</div></body></html>`;
                      const blob = new Blob([html], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = 'pie-charts-' + monthLabel.replace(/\s+/g,'-') + '.html';
                      a.click(); URL.revokeObjectURL(url);
                    }}>🥧 Pie Charts Only</button>
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

            {/* Pie Charts Only - downloadable section */}
            <div id="pie-charts-only">
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

      {reportType === 'stockcheck' && (() => {
  // Group current live stock by storage location
  const fridgeItems = inwards.filter(i => {
    const loc = i.moved_to || i.storage;
    return loc === 'fridge' && (i.qty_remaining ?? (i.qty_in - (i.total_taken || 0) - (i.total_wasted || 0))) > 0;
  });
  const freezerItems = inwards.filter(i => {
    const loc = i.moved_to || i.storage;
    return loc === 'freezer' && (i.qty_remaining ?? (i.qty_in - (i.total_taken || 0) - (i.total_wasted || 0))) > 0;
  });
  
  const getRemaining = (i: any) => i.qty_remaining ?? (i.qty_in - (i.total_taken || 0) - (i.total_wasted || 0));
  
  // Group by item name + category for summary
  const groupItems = (items: typeof inwards) => {
    const map: Record<string, { item: string; category: string; totalQty: number; unit: string; useBy: string[]; bestBefore: string[]; entries: typeof items }> = {};
    items.forEach(i => {
      const key = `${i.item}||${i.category}`;
      if (!map[key]) map[key] = { item: i.item, category: i.category, totalQty: 0, unit: i.unit || '', useBy: [], bestBefore: [], entries: [] };
      const rem = getRemaining(i);
      map[key].totalQty += rem;
      if (i.best_before) {
        if (isMeat(i.category)) map[key].useBy.push(i.best_before);
        else map[key].bestBefore.push(i.best_before);
      }
      map[key].entries.push(i);
    });
    return Object.values(map).sort((a, b) => a.item.localeCompare(b.item));
  };
  
  const fridgeGrouped = groupItems(fridgeItems);
  const freezerGrouped = groupItems(freezerItems);
  const totalFridge = fridgeGrouped.reduce((s, g) => s + g.totalQty, 0);
  const totalFreezer = freezerGrouped.reduce((s, g) => s + g.totalQty, 0);
  
  const downloadStockCheck = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    const renderTable = (title: string, emoji: string, groups: typeof fridgeGrouped, total: number) => {
      if (groups.length === 0) return `<p style="color:#94a3b8;font-size:13px;">No items in ${title.toLowerCase()}</p>`;
      return `
        <h2 style="font-size:18px;color:#16a34a;margin:20px 0 8px;border-bottom:2px solid #16a34a;padding-bottom:4px;">${emoji} ${title} — ${total} items</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f0fdf4;border-bottom:2px solid #16a34a;">
              <th style="text-align:left;padding:6px 8px;font-weight:700;">Item</th>
              <th style="text-align:left;padding:6px 8px;font-weight:700;">Category</th>
              <th style="text-align:center;padding:6px 8px;font-weight:700;">Qty</th>
              <th style="text-align:left;padding:6px 8px;font-weight:700;">Use By</th>
              <th style="text-align:left;padding:6px 8px;font-weight:700;">Best Before</th>
              <th style="text-align:center;padding:6px 8px;font-weight:700;width:60px;">✓</th>
            </tr>
          </thead>
          <tbody>
            ${groups.map((g, idx) => {
              const ub = g.useBy.length > 0 ? g.useBy.join(', ') : '-';
              const bb = g.bestBefore.length > 0 ? g.bestBefore.join(', ') : '-';
              const catColor = g.category === 'Meat' ? '#dc2626' : g.category === 'Bakery' ? '#d97706' : g.category === 'Vegetables' ? '#16a34a' : g.category === 'Dairy' ? '#2563eb' : '#6b7280';
              return `<tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
                <td style="padding:5px 8px;font-weight:600;">${g.item}</td>
                <td style="padding:5px 8px;"><span style="color:${catColor};font-weight:500;">${g.category}</span></td>
                <td style="padding:5px 8px;text-align:center;font-weight:700;font-size:15px;">${g.totalQty}</td>
                <td style="padding:5px 8px;font-size:12px;color:#64748b;">${ub}</td>
                <td style="padding:5px 8px;font-size:12px;color:#64748b;">${bb}</td>
                <td style="padding:5px 8px;text-align:center;"><span style="display:inline-block;width:18px;height:18px;border:2px solid #94a3b8;border-radius:3px;"></span></td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid #16a34a;background:#f0fdf4;">
              <td style="padding:6px 8px;font-weight:700;" colspan="2">TOTAL</td>
              <td style="padding:6px 8px;text-align:center;font-weight:800;font-size:16px;">${total}</td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>`;
    };
    
    const html = `<!DOCTYPE html><html><head><title>Stock Check — ${dateStr}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 22px; color: #16a34a; margin-bottom: 2px; text-align: center; }
        .subtitle { text-align: center; color: #64748b; font-size: 12px; margin-bottom: 20px; }
        .summary { display: flex; gap: 16px; justify-content: center; margin-bottom: 20px; }
        .summary-card { padding: 12px 20px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
        .summary-card .num { font-size: 24px; font-weight: 800; }
        .summary-card .label { font-size: 11px; color: #64748b; }
        .notes { margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
        .notes h3 { font-size: 14px; margin: 0 0 8px; }
        .notes-lines { border-top: 1px solid #e2e8f0; min-height: 80px; }
        .notes-lines div { border-bottom: 1px solid #f1f5f9; height: 24px; }
        @media print { body { padding: 10px; } }
      </style>
    </head><body>
      <h1>📋 Ramsey Community Fridge — Stock Check</h1>
      <p class="subtitle">${dateStr} at ${timeStr} | Living Hope, Commerce House, Bowring Road, Ramsey IM8 2LQ</p>
      <div class="summary">
        <div class="summary-card" style="background:#eff6ff;border-color:#bfdbfe;">
          <div class="num" style="color:#2563eb;">${totalFridge}</div>
          <div class="label">❄️ Fridge Items</div>
        </div>
        <div class="summary-card" style="background:#f0f9ff;border-color:#bae6fd;">
          <div class="num" style="color:#0284c7;">${totalFreezer}</div>
          <div class="label">🧊 Freezer Items</div>
        </div>
        <div class="summary-card" style="background:#f0fdf4;border-color:#bbf7d0;">
          <div class="num" style="color:#16a34a;">${totalFridge + totalFreezer}</div>
          <div class="label">📦 Total Stock</div>
        </div>
      </div>
      ${renderTable('Fridge', '❄️', fridgeGrouped, totalFridge)}
      ${renderTable('Freezer', '🧊', freezerGrouped, totalFreezer)}
      <div class="notes">
        <h3>📝 Notes</h3>
        <div class="notes-lines">${Array(4).fill('<div></div>').join('')}</div>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:10px;margin-top:16px;">Generated from Ramsey Community Fridge App</p>
    </body></html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock-Check-${now.toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // CSV download
  const downloadStockCSV = () => {
    let csv = 'Location,Item,Category,Quantity,Use By,Best Before\n';
    const addRows = (loc: string, groups: typeof fridgeGrouped) => {
      groups.forEach(g => {
        const ub = g.useBy.length > 0 ? g.useBy.join('; ') : '';
        const bb = g.bestBefore.length > 0 ? g.bestBefore.join('; ') : '';
        csv += `"${loc}","${g.item}","${g.category}",${g.totalQty},"${ub}","${bb}"\n`;
      });
    };
    addRows('Fridge', fridgeGrouped);
    addRows('Freezer', freezerGrouped);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock-Check-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRemaining2 = (i: any) => i.qty_remaining ?? (i.qty_in - (i.total_taken || 0) - (i.total_wasted || 0));

  return (
    <div className="space-y-3">
      {/* Header with buttons */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-bold text-green-700">📋 Stock Check — {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        <div className="flex gap-1">
          <button className="btn btn-xs btn-primary gap-1" onClick={downloadStockCheck}>🖨️ Print</button>
          <button className="btn btn-xs btn-secondary gap-1" onClick={downloadStockCSV}><Download size={12} /> CSV</button>
        </div>
      </div>
      
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card bg-blue-50 border border-blue-200 p-3 text-center">
          <p className="text-2xl font-black text-blue-700">{totalFridge}</p>
          <p className="text-[10px] text-blue-600 font-medium">❄️ Fridge</p>
        </div>
        <div className="card bg-cyan-50 border border-cyan-200 p-3 text-center">
          <p className="text-2xl font-black text-cyan-700">{totalFreezer}</p>
          <p className="text-[10px] text-cyan-600 font-medium">🧊 Freezer</p>
        </div>
        <div className="card bg-green-50 border border-green-200 p-3 text-center">
          <p className="text-2xl font-black text-green-700">{totalFridge + totalFreezer}</p>
          <p className="text-[10px] text-green-600 font-medium">📦 Total</p>
        </div>
      </div>
      
      {/* Fridge section */}
      {fridgeGrouped.length > 0 && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-3 space-y-2">
            <p className="text-xs font-bold text-blue-700">❄️ Fridge — {fridgeGrouped.length} items, {totalFridge} total qty</p>
            <div className="overflow-x-auto">
              <table className="table table-xs w-full">
                <thead><tr className="text-[10px]"><th>Item</th><th>Category</th><th className="text-center">Qty</th><th>Use By</th><th>Best Before</th></tr></thead>
                <tbody>
                  {fridgeGrouped.map((g, idx) => {
                    const catCls = CATEGORY_COLOURS[g.category] || 'bg-gray-100 text-gray-700';
                    return (
                      <tr key={idx} className="text-[10px]">
                        <td className="font-semibold">{g.item}</td>
                        <td><span className={`text-[9px] px-1.5 py-0.5 rounded-full ${catCls}`}>{g.category}</span></td>
                        <td className="text-center font-bold text-blue-600">{g.totalQty}</td>
                        <td className="text-base-content/60">{g.useBy.length > 0 ? g.useBy.join(', ') : '-'}</td>
                        <td className="text-base-content/60">{g.bestBefore.length > 0 ? g.bestBefore.join(', ') : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Freezer section */}
      {freezerGrouped.length > 0 && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-3 space-y-2">
            <p className="text-xs font-bold text-cyan-700">🧊 Freezer — {freezerGrouped.length} items, {totalFreezer} total qty</p>
            <div className="overflow-x-auto">
              <table className="table table-xs w-full">
                <thead><tr className="text-[10px]"><th>Item</th><th>Category</th><th className="text-center">Qty</th><th>Use By</th><th>Best Before</th></tr></thead>
                <tbody>
                  {freezerGrouped.map((g, idx) => {
                    const catCls = CATEGORY_COLOURS[g.category] || 'bg-gray-100 text-gray-700';
                    return (
                      <tr key={idx} className="text-[10px]">
                        <td className="font-semibold">{g.item}</td>
                        <td><span className={`text-[9px] px-1.5 py-0.5 rounded-full ${catCls}`}>{g.category}</span></td>
                        <td className="text-center font-bold text-cyan-600">{g.totalQty}</td>
                        <td className="text-base-content/60">{g.useBy.length > 0 ? g.useBy.join(', ') : '-'}</td>
                        <td className="text-base-content/60">{g.bestBefore.length > 0 ? g.bestBefore.join(', ') : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {fridgeGrouped.length === 0 && freezerGrouped.length === 0 && (
        <div className="text-center py-8 text-base-content/40">
          <p className="text-lg">📦</p>
          <p className="text-sm">No items currently in stock</p>
        </div>
      )}
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

      {/* ===== DONOR REPORT ===== */}
      {reportType === 'donor' && (() => {
        const donorItems = selectedDonor
          ? filteredInwards.filter(i => {
              const dLow = (i.donor || '').trim().toLowerCase();
              const sLow = selectedDonor.trim().toLowerCase();
              return dLow.includes(sLow) || sLow.includes(dLow);
            })
          : [];
        const sortedDonorItems = [...donorItems].sort((a, b) => {
          const da = parseDateStr(a.date_in)?.getTime() || 0;
          const db = parseDateStr(b.date_in)?.getTime() || 0;
          return db - da;
        });
        const donorTotalItems = donorItems.length;
        const donorTotalQty = donorItems.reduce((s, i) => s + (i.qty_in || 0), 0);
        const donorTotalValue = donorItems.reduce((s, i) => s + (i.unit_value || 0) * (i.qty_in || 0), 0);

        const getWeekNumber = (d: Date) => {
          const onejan = new Date(d.getFullYear(), 0, 1);
          return Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
        };
        const getWeekRangeLabel = (d: Date) => {
          const day = d.getDay();
          const diffToMonday = day === 0 ? -6 : 1 - day;
          const monday = new Date(d);
          monday.setDate(d.getDate() + diffToMonday);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          const fmt = (dt: Date) => dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          return `${fmt(monday)} - ${fmt(sunday)} ${sunday.getFullYear()}`;
        };

        const weeklyMap: Record<string, { label: string; count: number; qty: number; value: number; sortKey: number }> = {};
        donorItems.forEach(i => {
          const d = parseDateStr(i.date_in);
          if (!d) return;
          const wk = getWeekNumber(d);
          const key = `${d.getFullYear()}-W${wk}`;
          if (!weeklyMap[key]) weeklyMap[key] = { label: getWeekRangeLabel(d), count: 0, qty: 0, value: 0, sortKey: d.getTime() };
          weeklyMap[key].count++;
          weeklyMap[key].qty += i.qty_in || 0;
          weeklyMap[key].value += (i.unit_value || 0) * (i.qty_in || 0);
        });
        const weeklyRows = Object.entries(weeklyMap).sort((a, b) => a[1].sortKey - b[1].sortKey);

        const monthlyMap: Record<string, { label: string; count: number; qty: number; value: number }> = {};
        donorItems.forEach(i => {
          const d = parseDateStr(i.date_in);
          if (!d) return;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyMap[key]) monthlyMap[key] = { label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), count: 0, qty: 0, value: 0 };
          monthlyMap[key].count++;
          monthlyMap[key].qty += i.qty_in || 0;
          monthlyMap[key].value += (i.unit_value || 0) * (i.qty_in || 0);
        });
        const monthlyRows = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0]));

        const downloadDonorCSV = () => {
          let csv = 'DONOR REPORT\n';
          csv += `Donor,"${selectedDonor}"\n`;
          csv += `Period,${startDate} to ${endDate}\n`;
          csv += 'Includes,Live + Archived data\n\n';
          csv += 'Date,Item,Category,Qty,Unit,Value (£),Storage,Use By,Best Before\n';
          sortedDonorItems.forEach(i => {
            const val = (i.unit_value || 0) * (i.qty_in || 0);
            csv += `"${i.date_in}","${i.item}","${i.category}",${i.qty_in},"${i.unit}",${val > 0 ? val.toFixed(2) : ''},"${i.storage}","${isMeat(i.category) ? i.best_before || '' : '-'}","${isMeat(i.category) ? '-' : i.best_before || ''}"\n`;
          });
          csv += `\nTotal Items,,,${donorTotalItems}\nTotal Qty,,,${donorTotalQty}\nTotal Value (£),,,${donorTotalValue.toFixed(2)}\n\n`;

          csv += 'WEEKLY BREAKDOWN\nWeek,Items,Qty,Value (£)\n';
          weeklyRows.forEach(([, w]) => { csv += `"${w.label}",${w.count},${w.qty},${w.value.toFixed(2)}\n`; });
          csv += `Total,${donorTotalItems},${donorTotalQty},${donorTotalValue.toFixed(2)}\n\n`;

          csv += 'MONTHLY BREAKDOWN\nMonth,Items,Qty,Value (£)\n';
          monthlyRows.forEach(([, m]) => { csv += `"${m.label}",${m.count},${m.qty},${m.value.toFixed(2)}\n`; });
          csv += `Total,${donorTotalItems},${donorTotalQty},${donorTotalValue.toFixed(2)}\n`;

          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `donor-report-${selectedDonor.replace(/\s+/g, '-')}-${startDate}-to-${endDate}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        const downloadDonorHTML = () => {
          const itemsRows = sortedDonorItems.map((i, idx) => {
            const val = (i.unit_value || 0) * (i.qty_in || 0);
            return `<tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
              <td style="padding:5px 8px;">${i.date_in}</td>
              <td style="padding:5px 8px;font-weight:600;">${i.item}</td>
              <td style="padding:5px 8px;">${i.category}</td>
              <td style="padding:5px 8px;text-align:center;">${i.qty_in}</td>
              <td style="padding:5px 8px;">${i.unit}</td>
              <td style="padding:5px 8px;text-align:right;">${val > 0 ? '£' + val.toFixed(2) : '-'}</td>
              <td style="padding:5px 8px;">${i.storage === 'fridge' ? 'Fridge' : 'Freezer'}</td>
              <td style="padding:5px 8px;">${isMeat(i.category) ? i.best_before || '-' : '-'}</td>
              <td style="padding:5px 8px;">${isMeat(i.category) ? '-' : i.best_before || '-'}</td>
            </tr>`;
          }).join('');

          const weeklyRowsHtml = weeklyRows.map(([, w]) => `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:5px 8px;">${w.label}</td>
              <td style="padding:5px 8px;text-align:center;">${w.count}</td>
              <td style="padding:5px 8px;text-align:center;">${w.qty}</td>
              <td style="padding:5px 8px;text-align:right;">£${w.value.toFixed(2)}</td>
            </tr>`).join('');

          const monthlyRowsHtml = monthlyRows.map(([, m]) => `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:5px 8px;">${m.label}</td>
              <td style="padding:5px 8px;text-align:center;">${m.count}</td>
              <td style="padding:5px 8px;text-align:center;">${m.qty}</td>
              <td style="padding:5px 8px;text-align:right;">£${m.value.toFixed(2)}</td>
            </tr>`).join('');

          const html = `<!DOCTYPE html><html><head><title>Donor Report — ${selectedDonor}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; max-width: 900px; margin: 0 auto; }
              h1 { font-size: 20px; color: #c2410c; margin-bottom: 2px; }
              h2 { font-size: 14px; margin: 20px 0 8px; color: #ea580c; border-bottom: 2px solid #fed7aa; padding-bottom: 4px; }
              .subtitle { color: #64748b; font-size: 12px; margin-bottom: 20px; }
              .summary { display: flex; gap: 16px; margin-bottom: 16px; }
              .summary-card { flex: 1; padding: 12px 16px; border-radius: 8px; text-align: center; border: 1px solid #fed7aa; background: #fff7ed; }
              .summary-card .num { font-size: 22px; font-weight: 800; color: #c2410c; }
              .summary-card .label { font-size: 11px; color: #9a3412; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
              thead tr { background: #fff7ed; border-bottom: 2px solid #ea580c; }
              th { text-align: left; padding: 6px 8px; font-weight: 700; }
              tfoot tr { border-top: 2px solid #ea580c; background: #fff7ed; font-weight: 700; }
              tfoot td { padding: 6px 8px; }
              @media print { body { padding: 10px; } }
            </style>
          </head><body>
            <h1>🏢 Donor Report — ${selectedDonor}</h1>
            <p class="subtitle">Period: ${startDate} to ${endDate} | Includes live + archived data | Generated ${new Date().toLocaleDateString('en-GB')}</p>
            <div class="summary">
              <div class="summary-card"><div class="num">${donorTotalItems}</div><div class="label">Items Received</div></div>
              <div class="summary-card"><div class="num">${donorTotalQty}</div><div class="label">Total Quantity</div></div>
              <div class="summary-card"><div class="num">£${donorTotalValue.toFixed(2)}</div><div class="label">Total Value</div></div>
            </div>
            <h2>Items Received</h2>
            <table>
              <thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Qty</th><th>Unit</th><th>Value (£)</th><th>Storage</th><th>Use By</th><th>Best Before</th></tr></thead>
              <tbody>${itemsRows || '<tr><td colspan="9" style="padding:8px;color:#94a3b8;">No items in this period</td></tr>'}</tbody>
            </table>
            <h2>Weekly Breakdown</h2>
            <table>
              <thead><tr><th>Week</th><th style="text-align:center;">Items</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Value (£)</th></tr></thead>
              <tbody>${weeklyRowsHtml || '<tr><td colspan="4" style="padding:8px;color:#94a3b8;">No data</td></tr>'}</tbody>
              <tfoot><tr><td>Total</td><td style="text-align:center;">${donorTotalItems}</td><td style="text-align:center;">${donorTotalQty}</td><td style="text-align:right;">£${donorTotalValue.toFixed(2)}</td></tr></tfoot>
            </table>
            <h2>Monthly Breakdown</h2>
            <table>
              <thead><tr><th>Month</th><th style="text-align:center;">Items</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Value (£)</th></tr></thead>
              <tbody>${monthlyRowsHtml || '<tr><td colspan="4" style="padding:8px;color:#94a3b8;">No data</td></tr>'}</tbody>
              <tfoot><tr><td>Total</td><td style="text-align:center;">${donorTotalItems}</td><td style="text-align:center;">${donorTotalQty}</td><td style="text-align:right;">£${donorTotalValue.toFixed(2)}</td></tr></tfoot>
            </table>
            <p style="text-align:center;color:#94a3b8;font-size:10px;margin-top:16px;">Generated from Ramsey Community Fridge App</p>
          </body></html>`;

          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Donor-Report-${selectedDonor.replace(/\s+/g, '-')}-${startDate}-to-${endDate}.html`;
          a.click();
          URL.revokeObjectURL(url);
        };

        if (!selectedDonor) {
          return (
            <div className="bg-base-200/50 rounded-lg p-6 text-center">
              <p className="text-2xl mb-2">🏢</p>
              <p className="text-sm font-medium text-base-content/60">Select a donor above to generate their report</p>
            </div>
          );
        }

        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button className="btn btn-xs btn-primary gap-1" onClick={downloadDonorHTML}>🖨️ Print</button>
              <button className="btn btn-xs btn-secondary gap-1" onClick={downloadDonorCSV}><Download size={12} /> CSV</button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200">
                <div className="card-body p-3 text-center">
                  <p className="text-2xl font-bold text-orange-700">{donorTotalItems}</p>
                  <p className="text-xs text-orange-500">Items Received</p>
                </div>
              </div>
              <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
                <div className="card-body p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{donorTotalQty}</p>
                  <p className="text-xs text-amber-500">Total Quantity</p>
                </div>
              </div>
              <div className="card bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
                <div className="card-body p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">£{donorTotalValue.toFixed(2)}</p>
                  <p className="text-xs text-green-500">Total Value</p>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-orange-700">🏢 {selectedDonor} — Items Received</p>
                {sortedDonorItems.length === 0 ? (
                  <p className="text-xs text-base-content/40 text-center py-4">No items from this donor in this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr className="text-[10px]">
                          <th>Date</th><th>Item</th><th>Category</th><th>Qty</th><th>Unit</th><th>Value (£)</th><th>Storage</th><th>Use By</th><th>Best Before</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDonorItems.map(i => {
                          const val = (i.unit_value || 0) * (i.qty_in || 0);
                          const catCls = CATEGORY_COLOURS[i.category] || 'bg-gray-100 text-gray-700';
                          return (
                            <tr key={i.id} className="text-[10px]">
                              <td>{i.date_in}</td>
                              <td className="font-medium">{i.item}</td>
                              <td><span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${catCls}`}>{i.category}</span></td>
                              <td>{i.qty_in}</td>
                              <td>{i.unit}</td>
                              <td>{val > 0 ? `£${val.toFixed(2)}` : '-'}</td>
                              <td>{i.storage === 'fridge' ? '🧊 Fridge' : '❄️ Freezer'}</td>
                              <td>{isMeat(i.category) ? i.best_before || '-' : '-'}</td>
                              <td>{isMeat(i.category) ? '-' : i.best_before || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-blue-700">📅 Weekly Breakdown</p>
                {weeklyRows.length === 0 ? (
                  <p className="text-xs text-base-content/40 text-center py-4">No data in this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr className="text-[10px]"><th>Week</th><th className="text-center">Items</th><th className="text-center">Qty</th><th className="text-right">Value (£)</th></tr>
                      </thead>
                      <tbody>
                        {weeklyRows.map(([key, w]) => (
                          <tr key={key} className="text-[10px]">
                            <td>{w.label}</td>
                            <td className="text-center">{w.count}</td>
                            <td className="text-center">{w.qty}</td>
                            <td className="text-right">£{w.value.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="text-[10px] font-bold border-t-2">
                          <td>Total</td>
                          <td className="text-center">{donorTotalItems}</td>
                          <td className="text-center">{donorTotalQty}</td>
                          <td className="text-right">£{donorTotalValue.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-purple-700">🗓️ Monthly Breakdown</p>
                {monthlyRows.length === 0 ? (
                  <p className="text-xs text-base-content/40 text-center py-4">No data in this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr className="text-[10px]"><th>Month</th><th className="text-center">Items</th><th className="text-center">Qty</th><th className="text-right">Value (£)</th></tr>
                      </thead>
                      <tbody>
                        {monthlyRows.map(([key, m]) => (
                          <tr key={key} className="text-[10px]">
                            <td>{m.label}</td>
                            <td className="text-center">{m.count}</td>
                            <td className="text-center">{m.qty}</td>
                            <td className="text-right">£{m.value.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="text-[10px] font-bold border-t-2">
                          <td>Total</td>
                          <td className="text-center">{donorTotalItems}</td>
                          <td className="text-center">{donorTotalQty}</td>
                          <td className="text-right">£{donorTotalValue.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Custom Report Builder */}
      {reportType === 'custom' && (() => {
        // Gather all months from all data (inwards + outwards + wastage + archived)
        const allData = [...inwards, ...archivedInwards];
        const allOut = [...outwards, ...archivedOutwards];
        const allWaste = [...wastage, ...archivedWastage];
        const monthSet = new Set<string>();
        allData.forEach(i => { const d = parseDateStr(i.date_in); if (d) monthSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); });
        const inLookupM: Record<string, string> = {}; allData.forEach(i => { inLookupM[i.id] = i.date_in; });
        allOut.forEach(o => { const effD = o.source === 'bulk' && o.inward_id && inLookupM[o.inward_id] ? inLookupM[o.inward_id] : o.date_taken; const d = parseDateStr(effD); if (d) monthSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); });
        allWaste.forEach(w => { const d = parseDateStr(w.date_wasted); if (d) monthSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); });
        const availMonths = Array.from(monthSet).sort().reverse();
        const toggleMonth = (m: string) => setCustomMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
        const toggleSection = (key: string) => setCustomSections(prev => ({ ...prev, [key]: !prev[key] }));
        const selectAllMonths = () => setCustomMonths(availMonths);
        const clearAllMonths = () => setCustomMonths([]);

        // Filter data for selected months
        const inLookupC: Record<string, string> = {};
        allData.forEach(i => { inLookupC[i.id] = i.date_in; });
        const getEffDate = (o: any) => o.source === 'bulk' && o.inward_id && inLookupC[o.inward_id] ? inLookupC[o.inward_id] : o.date_taken;
        const inMonth = (dateStr: string) => {
          const d = parseDateStr(dateStr);
          if (!d) return false;
          const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          return customMonths.includes(m);
        };
        const cInwards = allData.filter(i => inMonth(i.date_in));
        const cOutwards = allOut.filter(o => inMonth(getEffDate(o)));
        const cWastage = allWaste.filter(w => inMonth(w.date_wasted));
        const cTotalIn = cInwards.reduce((s, i) => s + (i.qty_in || 0), 0);
        const cTotalOut = cOutwards.reduce((s, o) => s + o.qty_taken, 0);
        const cTotalWaste = cWastage.reduce((s, w) => s + w.qty_wasted, 0);
        const cTotalWeightKg = cWastage.reduce((s, w) => s + (w.weight_kg || 0), 0);

        // Breakdowns
        const cByCategory: Record<string, number> = {};
        cInwards.forEach(i => { cByCategory[i.category] = (cByCategory[i.category] || 0) + i.qty_in; });
        const cByCatArr = Object.entries(cByCategory).sort((a, b) => b[1] - a[1]);

        const cByDonor: Record<string, number> = {};
        cInwards.forEach(i => { const dn = i.donor || 'Unknown'; cByDonor[dn] = (cByDonor[dn] || 0) + i.qty_in; });
        const cByDonorArr = Object.entries(cByDonor).sort((a, b) => b[1] - a[1]);

        const cVolMap: Record<string, { inC: number; inQ: number; outC: number; outQ: number; wC: number; wQ: number }> = {};
        const cAddVol = (n: string) => { if (!cVolMap[n]) cVolMap[n] = { inC:0,inQ:0,outC:0,outQ:0,wC:0,wQ:0 }; return cVolMap[n]; };
        cInwards.forEach(i => { const v = cAddVol(i.entered_by || '?'); v.inC++; v.inQ += i.qty_in; });
        cOutwards.forEach(o => { const v = cAddVol(o.recorded_by || '?'); v.outC++; v.outQ += o.qty_taken; });
        cWastage.forEach(w => { const v = cAddVol(w.reported_by || '?'); v.wC++; v.wQ += w.qty_wasted; });
        const cVols = Object.entries(cVolMap).sort((a, b) => (b[1].inC+b[1].outC+b[1].wC) - (a[1].inC+a[1].outC+a[1].wC));

        const monthLabel = (m: string) => {
          const [y, mo] = m.split('-');
          return new Date(Number(y), Number(mo)-1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        };

        const selectedLabel = customMonths.length === 0 ? 'No months selected' :
          customMonths.length <= 3 ? customMonths.map(monthLabel).join(', ') :
          `${customMonths.length} months selected`;

        const hasData = customMonths.length > 0;

        // Pie chart helper
        const PIE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#e11d48'];
        const renderPie = (data: [string, number][], title: string) => {
          const total = data.reduce((s, [, v]) => s + v, 0);
          if (total === 0) return null;
          let cumAngle = 0;
          const slices = data.map(([label, val], idx) => {
            const pct = val / total;
            const startAngle = cumAngle;
            cumAngle += pct * 360;
            const endAngle = cumAngle;
            const startRad = (startAngle - 90) * Math.PI / 180;
            const endRad = (endAngle - 90) * Math.PI / 180;
            const largeArc = pct > 0.5 ? 1 : 0;
            const x1 = 50 + 40 * Math.cos(startRad);
            const y1 = 50 + 40 * Math.sin(startRad);
            const x2 = 50 + 40 * Math.cos(endRad);
            const y2 = 50 + 40 * Math.sin(endRad);
            const color = PIE_COLORS[idx % PIE_COLORS.length];
            if (data.length === 1) return <circle key={idx} cx="50" cy="50" r="40" fill={color} />;
            return <path key={idx} d={`M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`} fill={color} />;
          });
          return (
            <div className="space-y-2">
              <p className="text-xs font-bold text-center">{title}</p>
              <svg viewBox="0 0 100 100" className="w-32 h-32 mx-auto">{slices}</svg>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '4px' }}>
                {data.map(([label, val], idx) => (
                  <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                    <span style={{ color: PIE_COLORS[idx % PIE_COLORS.length], fontSize: '14px', lineHeight: '1' }}>■</span>
                    <span style={{ fontWeight: 600 }}>{label}:</span>
                    <span style={{ color: '#64748b' }}>{val} ({(val/total*100).toFixed(0)}%)</span>
                  </span>
                ))}
              </div>
            </div>
          );
        };

        // Print handler
        const printCustomReport = () => {
          const el = document.getElementById('custom-report-output');
          if (!el) return;
          const html = `<!DOCTYPE html><html><head><title>Custom Report — ${selectedLabel}</title>
            <style>body{font-family:system-ui,sans-serif;padding:20px;font-size:12px;color:#333}
            h1{font-size:18px;color:#5b21b6;margin-bottom:4px}h2{font-size:14px;margin:16px 0 6px;color:#6d28d9}
            table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ddd;padding:4px 8px;text-align:left;font-size:11px}
            th{background:#f3e8ff;font-weight:bold}.card{border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:8px 0;background:#faf5ff}
            .stat{display:inline-block;text-align:center;padding:8px 16px;margin:4px;border-radius:8px;background:#ede9fe}
            .stat-val{font-size:20px;font-weight:bold;color:#5b21b6}.stat-label{font-size:10px;color:#7c3aed}
            svg{max-width:200px;margin:8px auto;display:block}
            </style></head><body>
            <h1>📋 Ramsey Community Fridge — Custom Report</h1>
            <p style="color:#666;font-size:11px">Months: ${selectedLabel} | Generated: ${new Date().toLocaleDateString('en-GB')}</p><hr>
            ${el.innerHTML}</body></html>`;
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'custom-report-' + selectedLabel.replace(/[\\s,]+/g,'-') + '.html';
          a.click(); URL.revokeObjectURL(url);
        };

        const sectionDefs = [
          { key: 'inwardsSummary', label: '📥 Inwards Summary', icon: '📥' },
          { key: 'outwardsSummary', label: '📤 Outwards Summary', icon: '📤' },
          { key: 'wastageSummary', label: '🗑️ Wastage Summary', icon: '🗑️' },
          { key: 'donorBreakdown', label: '🏪 Donor Breakdown', icon: '🏪' },
          { key: 'categoryBreakdown', label: '📦 Category Breakdown', icon: '📦' },
          { key: 'volunteerActivity', label: '👥 Volunteer Activity', icon: '👥' },
          { key: 'pieCharts', label: '🥧 Pie Charts', icon: '🥧' },
        ];

        return (
          <div className="space-y-3">
            {/* Month selector */}
            <div className="card bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-indigo-800 flex items-center gap-1"><Calendar size={12} /> Select Months</p>
                  <div className="flex gap-1">
                    <button className="btn btn-xs btn-ghost text-indigo-600" onClick={selectAllMonths}>Select All</button>
                    <button className="btn btn-xs btn-ghost text-red-500" onClick={clearAllMonths}>Clear</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availMonths.map(m => (
                    <button
                      key={m}
                      className={`btn btn-xs ${customMonths.includes(m) ? 'btn-primary' : 'btn-outline btn-ghost'}`}
                      onClick={() => toggleMonth(m)}
                    >
                      {monthLabel(m)}
                    </button>
                  ))}
                  {availMonths.length === 0 && <p className="text-xs text-base-content/40">No data available yet</p>}
                </div>
              </div>
            </div>

            {/* Section selector */}
            <div className="card bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 shadow-sm">
              <div className="card-body p-3 space-y-2">
                <p className="text-xs font-bold text-violet-800 flex items-center gap-1"><Filter size={12} /> Choose Sections</p>
                <div className="flex flex-wrap gap-2">
                  {sectionDefs.map(sd => (
                    <label key={sd.key} className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" className="checkbox checkbox-xs checkbox-primary" checked={customSections[sd.key]} onChange={() => toggleSection(sd.key)} />
                      <span className="text-xs">{sd.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Action bar */}
            {hasData && (
              <div className="flex gap-2">
                <button className="btn btn-xs btn-primary gap-1" onClick={printCustomReport}>🖨️ Print Report</button>
                <span className="text-xs text-base-content/50 self-center">{selectedLabel}</span>
              </div>
            )}

            {/* Report output */}
            {hasData && (
              <div id="custom-report-output" className="space-y-3">
                {/* Overview stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-lg font-extrabold text-green-700">{cTotalIn}</p>
                    <p className="text-[10px] text-green-600 font-medium">Items In</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-3 text-center">
                    <p className="text-lg font-extrabold text-blue-700">{cTotalOut}</p>
                    <p className="text-[10px] text-blue-600 font-medium">Items Out</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg p-3 text-center">
                    <p className="text-lg font-extrabold text-red-700">{cTotalWaste}</p>
                    <p className="text-[10px] text-red-600 font-medium">Wastage</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-3 text-center">
                    <p className="text-lg font-extrabold text-purple-700">{cTotalIn > 0 ? ((cTotalOut / cTotalIn) * 100).toFixed(0) : 0}%</p>
                    <p className="text-[10px] text-purple-600 font-medium">Efficiency</p>
                  </div>
                </div>

                {/* Inwards Summary */}
                {customSections.inwardsSummary && cInwards.length > 0 && (
                  <div className="card bg-base-100 border border-base-300 shadow-sm">
                    <div className="card-body p-3 space-y-2">
                      <p className="text-xs font-bold text-green-700">📥 Inwards Summary — {cInwards.length} entries, {cTotalIn} items</p>
                      <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                          <thead><tr className="text-[10px]"><th>Date</th><th>Time</th><th>Item</th><th className="text-center">Qty</th><th>Location</th><th>Donor</th><th>Volunteer</th></tr></thead>
                          <tbody>
                            {cInwards.slice(0, 100).map((i, idx) => (
                              <tr key={idx} className="text-[10px]">
                                <td>{i.date_in}</td><td>{i.time_in || '-'}</td><td className="font-medium">{i.item}</td>
                                <td className="text-center font-bold text-green-600">{i.qty_in}</td>
                                <td>{i.storage}</td><td>{i.donor || '-'}</td><td>{i.entered_by || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {cInwards.length > 100 && <p className="text-[10px] text-base-content/40 mt-1">Showing first 100 of {cInwards.length} entries</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Outwards Summary */}
                {customSections.outwardsSummary && cOutwards.length > 0 && (
                  <div className="card bg-base-100 border border-base-300 shadow-sm">
                    <div className="card-body p-3 space-y-2">
                      <p className="text-xs font-bold text-blue-700">📤 Outwards Summary — {cOutwards.length} entries, {cTotalOut} items</p>
                      <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                          <thead><tr className="text-[10px]"><th>Date</th><th>Time</th><th>Item</th><th className="text-center">Qty</th><th>Donor</th><th>Volunteer</th><th>Source</th></tr></thead>
                          <tbody>
                            {cOutwards.slice(0, 100).map((o, idx) => {
                              const srcBadge = o.source === 'import' ? '🟠 Import' : o.source === 'bulk' ? '🟣 Bulk' : '🟢 Manual';
                              return (
                                <tr key={idx} className="text-[10px]">
                                  <td>{o.date_taken}</td><td>{o.time_taken || '-'}</td><td className="font-medium">{o.item}</td>
                                  <td className="text-center font-bold text-blue-600">{o.qty_taken}</td>
                                  <td>{o.donor || '-'}</td><td>{o.recorded_by || '-'}</td>
                                  <td><span className="text-[9px]">{srcBadge}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {cOutwards.length > 100 && <p className="text-[10px] text-base-content/40 mt-1">Showing first 100 of {cOutwards.length} entries</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Wastage Summary */}
                {customSections.wastageSummary && cWastage.length > 0 && (
                  <div className="card bg-base-100 border border-base-300 shadow-sm">
                    <div className="card-body p-3 space-y-2">
                      <p className="text-xs font-bold text-red-700">🗑️ Wastage Summary — {cWastage.length} entries, {cTotalWaste} items, {cTotalWeightKg.toFixed(1)} kg</p>
                      <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                          <thead><tr className="text-[10px]"><th>Date</th><th>Item</th><th className="text-center">Qty</th><th className="text-center">KG</th><th className="text-center">lbs</th><th>Reason</th><th>Donor</th><th>Volunteer</th></tr></thead>
                          <tbody>
                            {cWastage.slice(0, 100).map((w, idx) => (
                              <tr key={idx} className="text-[10px]">
                                <td>{w.date_wasted}</td><td className="font-medium">{w.item}</td>
                                <td className="text-center font-bold text-red-600">{w.qty_wasted}</td>
                                <td className="text-center">{w.weight_kg || '-'}</td>
                                <td className="text-center">{w.weight_kg ? kgToLbs(w.weight_kg) : '-'}</td>
                                <td>{w.reason}</td><td>{w.donor || '-'}</td><td>{w.reported_by || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Donor Breakdown */}
                {customSections.donorBreakdown && cByDonorArr.length > 0 && (
                  <div className="card bg-base-100 border border-base-300 shadow-sm">
                    <div className="card-body p-3 space-y-2">
                      <p className="text-xs font-bold text-orange-700">🏪 Donor Breakdown</p>
                      <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                          <thead><tr className="text-[10px]"><th>Donor</th><th className="text-center">Items</th><th className="text-center">% of Total</th><th>Bar</th></tr></thead>
                          <tbody>
                            {cByDonorArr.map(([donor, qty]) => (
                              <tr key={donor} className="text-[10px]">
                                <td className="font-medium">{donor}</td>
                                <td className="text-center font-bold text-orange-600">{qty}</td>
                                <td className="text-center">{cTotalIn > 0 ? ((qty/cTotalIn)*100).toFixed(1) : 0}%</td>
                                <td><div className="w-full bg-orange-100 rounded-full h-2"><div className="bg-orange-500 h-2 rounded-full" style={{ width: `${cTotalIn > 0 ? (qty/cTotalIn*100) : 0}%` }} /></div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Category Breakdown */}
                {customSections.categoryBreakdown && cByCatArr.length > 0 && (
                  <div className="card bg-base-100 border border-base-300 shadow-sm">
                    <div className="card-body p-3 space-y-2">
                      <p className="text-xs font-bold text-teal-700">📦 Category Breakdown</p>
                      <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                          <thead><tr className="text-[10px]"><th>Category</th><th className="text-center">Items</th><th className="text-center">% of Total</th><th>Bar</th></tr></thead>
                          <tbody>
                            {cByCatArr.map(([cat, qty]) => {
                              const catCls = CATEGORY_COLOURS[cat] || 'bg-gray-100 text-gray-700';
                              return (
                                <tr key={cat} className="text-[10px]">
                                  <td><span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${catCls}`}>{cat}</span></td>
                                  <td className="text-center font-bold">{qty}</td>
                                  <td className="text-center">{cTotalIn > 0 ? ((qty/cTotalIn)*100).toFixed(1) : 0}%</td>
                                  <td><div className="w-full bg-teal-100 rounded-full h-2"><div className="bg-teal-500 h-2 rounded-full" style={{ width: `${cTotalIn > 0 ? (qty/cTotalIn*100) : 0}%` }} /></div></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Volunteer Activity */}
                {customSections.volunteerActivity && Object.keys(cVolMap).length > 0 && (
                  <div className="card bg-base-100 border border-base-300 shadow-sm">
                    <div className="card-body p-3 space-y-2">
                      <p className="text-xs font-bold text-violet-700">👥 Volunteer Activity</p>
                      <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                          <thead><tr className="text-[10px]"><th>Volunteer</th><th className="text-center">📥 In</th><th className="text-center">📤 Out</th><th className="text-center">🗑️ Waste</th><th className="text-center">Total</th></tr></thead>
                          <tbody>
                            {Object.entries(cVolMap).sort((a,b) => (b[1].inC+b[1].outC+b[1].wC) - (a[1].inC+a[1].outC+a[1].wC)).map(([name, d]) => (
                              <tr key={name} className="text-[10px]">
                                <td className="font-medium">{name}</td>
                                <td className="text-center text-green-600 font-bold">{d.inQ} <span className="text-base-content/40">({d.inC})</span></td>
                                <td className="text-center text-blue-600 font-bold">{d.outQ} <span className="text-base-content/40">({d.outC})</span></td>
                                <td className="text-center text-red-600 font-bold">{d.wQ} <span className="text-base-content/40">({d.wC})</span></td>
                                <td className="text-center font-bold">{d.inC + d.outC + d.wC}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pie Charts */}
                {customSections.pieCharts && cTotalIn > 0 && (
                  <div className="card bg-base-100 border border-base-300 shadow-sm">
                    <div className="card-body p-3 space-y-2">
                      <p className="text-xs font-bold text-indigo-700">🥧 Pie Charts</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderPie(cByDonorArr, '🏪 Donor Share')}
                        {renderPie(cByCatArr, '📦 Category Breakdown')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Month-by-month breakdown */}
                {customMonths.length > 1 && (
                  <div className="card bg-base-100 border border-base-300 shadow-sm">
                    <div className="card-body p-3 space-y-2">
                      <p className="text-xs font-bold text-indigo-700">📅 Month-by-Month Comparison</p>
                      <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                          <thead><tr className="text-[10px]"><th>Month</th><th className="text-center">📥 In</th><th className="text-center">📤 Out</th><th className="text-center">🗑️ Waste</th><th className="text-center">Efficiency</th></tr></thead>
                          <tbody>
                            {(() => { const inLookup: Record<string, string> = {}; allData.forEach(i => { inLookup[i.id] = i.date_in; }); return customMonths.sort().map(m => {
                              const mIn = allData.filter(i => { const d = parseDateStr(i.date_in); return d && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === m; });
                              const mOut = allOut.filter(o => { const effDate = o.source === 'bulk' && o.inward_id && inLookup[o.inward_id] ? inLookup[o.inward_id] : o.date_taken; const d = parseDateStr(effDate); return d && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === m; });
                              const mW = allWaste.filter(w => { const d = parseDateStr(w.date_wasted); return d && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === m; });
                              const mInQ = mIn.reduce((s, i) => s + (i.qty_in || 0), 0);
                              const mOutQ = mOut.reduce((s, o) => s + o.qty_taken, 0);
                              const mWQ = mW.reduce((s, w) => s + w.qty_wasted, 0);
                              return (
                                <tr key={m} className="text-[10px]">
                                  <td className="font-medium">{monthLabel(m)}</td>
                                  <td className="text-center font-bold text-green-600">{mInQ}</td>
                                  <td className="text-center font-bold text-blue-600">{mOutQ}</td>
                                  <td className="text-center font-bold text-red-600">{mWQ}</td>
                                  <td className="text-center font-bold text-purple-600">{mInQ > 0 ? ((mOutQ/mInQ)*100).toFixed(0) : 0}%</td>
                                </tr>
                              );
                            }); })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!hasData && (
              <div className="bg-base-200/50 rounded-lg p-6 text-center">
                <p className="text-2xl mb-2">📋</p>
                <p className="text-sm font-medium text-base-content/60">Select one or more months above to build your report</p>
                <p className="text-xs text-base-content/40 mt-1">Then choose which sections to include</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Full report extras */}
      {isFullReport && reportType !== 'custom' && reportType !== 'donor' && (
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
