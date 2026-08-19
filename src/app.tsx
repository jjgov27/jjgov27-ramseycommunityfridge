import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, Trash2, ListPlus, FileBarChart, Archive, Shield, RefreshCw, User } from 'lucide-react';
import { TabName, StorageLocation, InwardItem, OutwardEntry, WastageEntry, CustomItem, ArchivedRecord, Volunteer, Donor, CustomCategory } from './types';
import {
  initDB, addInward, loadInwards, addOutward, loadOutwards, addWastage, loadWastage,
  deleteOutward, deleteWastage, deleteInward, loadCustomItems, addCustomItem, deleteCustomItem,
  archiveCompletedItems, loadArchive, deleteArchiveItem,
  clearAllData, clearArchive, clearEverything, importInwardsFromCSV, importOutwardsFromCSV, importWastageFromCSV, importCustomItems,
  loadVolunteers, addVolunteer, deleteVolunteer, importVolunteers, bulkInwardsToOutwards,
  loadDonors, addDonor, deleteDonor, importDonors, moveInwardItem, quickTakeAllAvailable,
  updateInward, updateOutward, bulkAddInwards, updateCustomItemCategory,
  loadCustomCategories, addCustomCategory, deleteCustomCategory, importCustomCategories
} from './utils/db';
import { Dashboard } from './components/Dashboard';
import { InwardsTab } from './components/InwardsTab';
import { OutwardsTab } from './components/OutwardsTab';
import { WastageTab } from './components/WastageTab';
import { ItemsTab } from './components/ItemsTab';
import { ReportsTab } from './components/ReportsTab';
import { HistoryTab } from './components/HistoryTab';
import { AdminTab } from './components/AdminTab';

// Module-level first-load cache — survives React strict mode remounts
let _firstLoadPromise: Promise<{inv: any; out: any; wst: any; ci: any; arch: any; vols: any; dnrs: any; cats: any}> | null = null;
function firstLoad() {
  if (!_firstLoadPromise) {
    _firstLoadPromise = initDB().then(async () => {
      // Sequential to avoid GCS rate limit (even reads count as mutations on db.bin)
      const inv = await loadInwards();
      const out = await loadOutwards();
      const wst = await loadWastage();
      const ci = await loadCustomItems();
      const arch = await loadArchive();
      const vols = await loadVolunteers();
      const dnrs = await loadDonors();
      const cats = await loadCustomCategories();
      return { inv, out, wst, ci, arch, vols, dnrs, cats };
    });
  }
  return _firstLoadPromise;
}

const TABS: { id: TabName; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Home', icon: <LayoutDashboard size={16} /> },
  { id: 'inwards', label: 'In', icon: <ArrowDownToLine size={16} /> },
  { id: 'outwards', label: 'Out', icon: <ArrowUpFromLine size={16} /> },
  { id: 'wastage', label: 'Waste', icon: <Trash2 size={16} /> },
  { id: 'items', label: 'Settings', icon: <ListPlus size={16} /> },
  { id: 'reports', label: 'Reports', icon: <FileBarChart size={16} /> },
  { id: 'history', label: 'History', icon: <Archive size={16} /> },
  { id: 'admin', label: 'Admin', icon: <Shield size={16} /> },
];

const App: React.FC = () => {
  const [tab, setTab] = useState<TabName>('dashboard');
  const [storage, setStorage] = useState<StorageLocation>('fridge');
  const [inwards, setInwards] = useState<InwardItem[]>([]);
  const [outwards, setOutwards] = useState<OutwardEntry[]>([]);
  const [wastage, setWastage] = useState<WastageEntry[]>([]);
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [archive, setArchive] = useState<ArchivedRecord[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Active volunteer session — persisted to localStorage
  const [activeVolunteer, setActiveVolunteer] = useState<string>(() => {
    try { return localStorage.getItem('cf_active_volunteer') || ''; } catch { return ''; }
  });

  useEffect(() => {
    try { localStorage.setItem('cf_active_volunteer', activeVolunteer); } catch {}
  }, [activeVolunteer]);

  const refresh = useCallback(async () => {
    // Sequential to avoid GCS rate limit
    const inv = await loadInwards(); setInwards(inv);
    const out = await loadOutwards(); setOutwards(out);
    const wst = await loadWastage(); setWastage(wst);
    const ci = await loadCustomItems(); setCustomItems(ci);
    const arch = await loadArchive(); setArchive(arch);
    const vols = await loadVolunteers(); setVolunteers(vols);
    const dnrs = await loadDonors(); setDonors(dnrs);
    const cats = await loadCustomCategories(); setCustomCategories(cats);
  }, []);

  // Targeted refresh functions — only reload the table(s) affected by an action
  const refreshInwards = useCallback(async () => { setInwards(await loadInwards()); }, []);
  const refreshOutwards = useCallback(async () => { setOutwards(await loadOutwards()); }, []);
  const refreshWastage = useCallback(async () => { setWastage(await loadWastage()); }, []);
  const refreshItems = useCallback(async () => { setCustomItems(await loadCustomItems()); }, []);
  const refreshVolunteers = useCallback(async () => { setVolunteers(await loadVolunteers()); }, []);
  const refreshDonors = useCallback(async () => { setDonors(await loadDonors()); }, []);
  const refreshArchive = useCallback(async () => { setArchive(await loadArchive()); }, []);
  const refreshCategories = useCallback(async () => { setCustomCategories(await loadCustomCategories()); }, []);

  useEffect(() => {
    firstLoad().then(({ inv, out, wst, ci, arch, vols, dnrs, cats }) => {
      setInwards(inv); setOutwards(out); setWastage(wst); setCustomItems(ci);
      setArchive(arch); setVolunteers(vols); setDonors(dnrs); setCustomCategories(cats);
      setLoading(false);
    });
  }, []);

  const handleRefresh = async () => {
    if (actionInProgress) return;
    setActionInProgress(true);
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
      setActionInProgress(false);
    }
  };

  const handleAddInward = async (item: string, category: string, qty: number, unit: string, donor: string, bestBefore: string, stor: StorageLocation, enteredBy?: string, overrideDate?: string, unitValue?: number) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      let formattedBB = bestBefore;
      if (bestBefore && bestBefore.includes('-')) {
        const [y, m, d] = bestBefore.split('-');
        formattedBB = `${d}/${m}/${y}`;
      }
      let formattedDate = overrideDate;
      if (overrideDate && overrideDate.includes('-')) {
        const [y, m, d] = overrideDate.split('-');
        formattedDate = `${d}/${m}/${y}`;
      }
      await addInward(item, category, qty, unit, donor, formattedBB, stor, enteredBy || '', formattedDate, unitValue || 0);
      await refreshInwards();
    } finally {
      setActionInProgress(false);
    }
  };

  const handleBulkAddInward = async (items: Array<{
    item: string; category: string; qty: number; unit: string;
    donor: string; bestBefore: string; storage: StorageLocation;
    enteredBy: string; date: string; unitValue: number;
  }>): Promise<number> => {
    if (actionInProgress) return 0;
    setActionInProgress(true);
    try {
      const count = await bulkAddInwards(items);
      await refreshInwards();
      return count;
    } finally {
      setActionInProgress(false);
    }
  };

  const handleTake = async (inwardId: string, qty: number, takenBy: string, recordedBy: string, overrideDate?: string) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      let formattedDate = overrideDate;
      if (overrideDate && overrideDate.includes('-')) {
        const [y, m, d] = overrideDate.split('-');
        formattedDate = `${d}/${m}/${y}`;
      }
      await addOutward(inwardId, qty, takenBy, recordedBy, formattedDate);
      await refreshInwards();
      await refreshOutwards();
    } finally {
      setActionInProgress(false);
    }
  };

  const handleAddWastage = async (inwardId: string, qty: number, reason: string, reportedBy: string, notes: string, overrideDate?: string, weightKg?: number) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      let formattedDate = overrideDate;
      if (overrideDate && overrideDate.includes('-')) {
        const [y, m, d] = overrideDate.split('-');
        formattedDate = `${d}/${m}/${y}`;
      }
      await addWastage(inwardId, qty, reason, reportedBy, notes, formattedDate, weightKg || 0);
      await refreshInwards();
      await refreshWastage();
    } finally {
      setActionInProgress(false);
    }
  };

  const handleMoveItem = async (id: string, newStorage: StorageLocation) => {
    await moveInwardItem(id, newStorage);
    await refreshInwards();
  };

  const handleDeleteOutward = async (id: number) => { await deleteOutward(id); await refreshInwards(); await refreshOutwards(); };
  const handleDeleteWastage = async (id: number) => { await deleteWastage(id); await refreshInwards(); await refreshWastage(); };
  const handleDeleteInward = async (id: string) => { await deleteInward(id); await refreshInwards(); await refreshOutwards(); await refreshWastage(); };

  const handleEditInward = async (id: string, fields: { item?: string; category?: string; qty_in?: number; donor?: string; best_before?: string; entered_by?: string }) => {
    await updateInward(id, fields);
    // If category was changed, also update master Items list so future imports use the corrected category
    if (fields.item && fields.category) {
      await updateCustomItemCategory(fields.item, fields.category);
      await refreshItems();
    }
    await refreshInwards();
  };

  const handleEditOutward = async (id: number, fields: { qty_taken?: number; taken_by?: string; recorded_by?: string }) => {
    await updateOutward(id, fields);
    await refreshInwards();
    await refreshOutwards();
  };

  const handleAddCustomItem = async (name: string, category: string) => {
    await addCustomItem(name, category);
    await refreshItems();
  };
  const handleDeleteCustomItem = async (id: number) => {
    await deleteCustomItem(id);
    await refreshItems();
  };

  // Archive completed items
  const handleArchive = async () => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      const count = await archiveCompletedItems();
      await refreshInwards();
      await refreshOutwards();
      await refreshWastage();
      await refreshArchive();
      if (count > 0) {
        setArchiveMsg(`✅ Archived ${count} completed item${count !== 1 ? 's' : ''} to history`);
      } else {
        setArchiveMsg('ℹ️ No completed items to archive (all items still have remaining stock)');
      }
      setTimeout(() => setArchiveMsg(null), 4000);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteArchive = async (id: string) => {
    await deleteArchiveItem(id);
    await refreshArchive();
  };

  // Bulk inwards to outwards
  const handleBulkOutwards = async (): Promise<number> => {
    const count = await bulkInwardsToOutwards(activeVolunteer);
    await refreshInwards();
    await refreshOutwards();
    return count;
  };

  // Admin actions
  const handleClearLive = async () => { await clearAllData(); await refreshInwards(); await refreshOutwards(); await refreshWastage(); };
  const handleClearArchive = async () => { await clearArchive(); await refreshArchive(); };
  const handleClearEverything = async () => { await clearEverything(); await refresh(); };
  const handleImportInwards = async (csv: string): Promise<number> => {
    const count = await importInwardsFromCSV(csv);
    await refreshInwards();
    return count;
  };
  const handleImportOutwards = async (csv: string): Promise<number> => {
    const count = await importOutwardsFromCSV(csv);
    await refreshInwards();
    await refreshOutwards();
    return count;
  };
  const handleImportWastage = async (csv: string): Promise<number> => {
    const count = await importWastageFromCSV(csv);
    await refreshInwards();
    await refreshWastage();
    return count;
  };
  const handleImportItems = async (csv: string): Promise<number> => {
    const count = await importCustomItems(csv);
    await refreshItems();
    return count;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-blue-50">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-emerald-500" />
          <p className="mt-2 text-sm text-base-content/60">Loading Community Fridge...</p>
        </div>
      </div>
    );
  }

  // Count completed items for archive badge
  const completedCount = inwards.filter(i => i.status === 'gone').length;

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧊</span>
          <div>
            <span className="font-bold text-sm">Community Fridge</span>
            <span className="text-xs text-white/70 ml-2">Tracker</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Animated login prompt when no volunteer selected */}
          {!activeVolunteer && (
            <div className="flex items-center gap-1 mr-1 animate-bounce">
              <span className="text-2xl">👉</span>
              <span className="text-yellow-200 text-base font-extrabold whitespace-nowrap">Log in here</span>
              <span className="text-yellow-200 text-2xl font-bold">→</span>
            </div>
          )}
          {/* Volunteer session selector */}
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1 transition-all ${!activeVolunteer ? 'bg-yellow-400/30 ring-2 ring-yellow-300 animate-pulse' : 'bg-white/15'}`}>
            <User size={12} className={!activeVolunteer ? 'text-yellow-200' : 'text-white/70'} />
            <select
              className="bg-transparent text-white text-xs border-none outline-none cursor-pointer appearance-none pr-3"
              value={activeVolunteer}
              onChange={e => setActiveVolunteer(e.target.value)}
              style={{ backgroundImage: 'none' }}
            >
              <option value="" className="text-gray-800">Select volunteer...</option>
              {volunteers.map(v => (
                <option key={v.id} value={v.initials} className="text-gray-800">
                  {v.initials} — {v.name}
                </option>
              ))}
            </select>
            <span className={`text-xs ${!activeVolunteer ? 'text-yellow-200' : 'text-white/40'}`}>▾</span>
          </div>
          {/* Archive button in header */}
          {completedCount > 0 && (
            <button
              className="btn btn-ghost btn-xs text-white hover:bg-white/20 gap-1"
              onClick={handleArchive}
              title="Archive completed items to history"
            >
              <Archive size={14} />
              <span className="badge badge-xs bg-white/20 text-white border-0">{completedCount}</span>
            </button>
          )}
          <button className="btn btn-ghost btn-xs text-white hover:bg-white/20" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Active volunteer banner */}
      {activeVolunteer && (
        <div className="px-3 py-1.5 text-xs text-center bg-emerald-50 text-emerald-700 font-medium border-b border-emerald-200">
          👤 Logged in as: <strong>{activeVolunteer}</strong> — {volunteers.find(v => v.initials === activeVolunteer)?.name || activeVolunteer}
        </div>
      )}

      {/* Archive message */}
      {archiveMsg && (
        <div className="px-3 py-2 text-xs text-center bg-success/10 text-success font-medium">
          {archiveMsg}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex bg-base-200 border-b border-base-300 px-1 py-1.5 gap-0.5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-sm transition-all min-w-0 ${
              tab === t.id
                ? 'bg-white shadow-md text-emerald-700 font-extrabold border border-emerald-200'
                : 'text-gray-700 font-semibold hover:bg-base-300 hover:text-gray-900'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'dashboard' && (
          <Dashboard
            inwards={inwards} outwards={outwards} wastage={wastage}
            storage={storage} onStorageChange={setStorage}
            onNavigate={(t) => setTab(t)}
            donors={donors}
          />
        )}
        {tab === 'inwards' && (
          <InwardsTab
            inwards={inwards} customItems={customItems}
            storage={storage} onStorageChange={setStorage}
            onAdd={handleAddInward} onDelete={handleDeleteInward}
            onMove={handleMoveItem} onEdit={handleEditInward}
            onBulkAdd={handleBulkAddInward}
            activeVolunteer={activeVolunteer} volunteers={volunteers}
            donors={donors}
            onRefreshItems={refreshItems}
            customCategories={customCategories}
          />
        )}
        {tab === 'outwards' && (
          <OutwardsTab
            inwards={inwards} outwards={outwards}
            storage={storage} onStorageChange={setStorage}
            onTake={handleTake} onTakeAll={async (s, by, rec, d) => { const c = await quickTakeAllAvailable(s, by, rec, d); await refreshInwards(); await refreshOutwards(); return c; }} onDelete={handleDeleteOutward}
            onEdit={handleEditOutward} activeVolunteer={activeVolunteer} volunteers={volunteers}
          />
        )}
        {tab === 'wastage' && (
          <WastageTab
            inwards={inwards} wastage={wastage}
            storage={storage} onStorageChange={setStorage}
            onAdd={handleAddWastage} onDelete={handleDeleteWastage}
            activeVolunteer={activeVolunteer} volunteers={volunteers}
          />
        )}
        {tab === 'items' && (
          <ItemsTab
            customItems={customItems}
            onAdd={handleAddCustomItem}
            onDelete={handleDeleteCustomItem}
            onImportItems={async (csv: string) => {
              const count = await importCustomItems(csv);
              await refreshItems();
              return count;
            }}
            volunteers={volunteers}
            onAddVolunteer={async (name: string, initials: string) => {
              await addVolunteer(name, initials);
              await refreshVolunteers();
            }}
            onDeleteVolunteer={async (id: number) => {
              await deleteVolunteer(id);
              await refreshVolunteers();
            }}
            onImportVolunteers={async (csv: string) => {
              const count = await importVolunteers(csv);
              await refreshVolunteers();
              return count;
            }}
            donors={donors}
            onAddDonor={async (name: string) => {
              await addDonor(name);
              await refreshDonors();
            }}
            onDeleteDonor={async (id: number) => {
              await deleteDonor(id);
              await refreshDonors();
            }}
            onImportDonors={async (csv: string) => {
              const count = await importDonors(csv);
              await refreshDonors();
              return count;
            }}
            customCategories={customCategories}
            onAddCategory={async (name: string, colour: string) => {
              await addCustomCategory(name, colour);
              await refreshCategories();
            }}
            onDeleteCategory={async (id: number) => {
              await deleteCustomCategory(id);
              await refreshCategories();
            }}
            onImportCategories={async (csv: string) => {
              const count = await importCustomCategories(csv);
              await refreshCategories();
              return count;
            }}
          />
        )}
        {tab === 'reports' && (
          <ReportsTab
            inwards={inwards} wastage={wastage} outwards={outwards}
            storage={storage} onStorageChange={setStorage}
            archive={archive} customItems={customItems}
            donors={donors} customCategories={customCategories}
          />
        )}
        {tab === 'history' && (
          <HistoryTab
            archive={archive}
            storage={storage} onStorageChange={setStorage}
            onDelete={handleDeleteArchive}
          />
        )}
        {tab === 'admin' && (
          <AdminTab
            onClearLive={handleClearLive}
            onClearArchive={handleClearArchive}
            onClearEverything={handleClearEverything}
            onImportInwards={handleImportInwards}
            onImportOutwards={handleImportOutwards}
            onImportWastage={handleImportWastage}
            onImportItems={handleImportItems}
            onBulkOutwards={handleBulkOutwards}
            inwardsCount={inwards.filter(i => i.qty_remaining > 0).length}
          />
        )}
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
