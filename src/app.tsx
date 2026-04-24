import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, Trash2, ListPlus, FileBarChart, Archive, Shield, RefreshCw } from 'lucide-react';
import { TabName, StorageLocation, InwardItem, OutwardEntry, WastageEntry, CustomItem, ArchivedRecord, Volunteer } from './types';
import {
  initDB, addInward, loadInwards, addOutward, loadOutwards, addWastage, loadWastage,
  deleteOutward, deleteWastage, deleteInward, loadCustomItems, addCustomItem, deleteCustomItem,
  archiveCompletedItems, loadArchive, deleteArchiveItem,
  clearAllData, clearArchive, clearEverything, importInwardsFromCSV, importOutwardsFromCSV, importWastageFromCSV, importCustomItems,
  loadVolunteers, addVolunteer, deleteVolunteer, importVolunteers
} from './utils/db';
import { Dashboard } from './components/Dashboard';
import { InwardsTab } from './components/InwardsTab';
import { OutwardsTab } from './components/OutwardsTab';
import { WastageTab } from './components/WastageTab';
import { ItemsTab } from './components/ItemsTab';
import { ReportsTab } from './components/ReportsTab';
import { HistoryTab } from './components/HistoryTab';
import { AdminTab } from './components/AdminTab';

const TABS: { id: TabName; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Home', icon: <LayoutDashboard size={14} /> },
  { id: 'inwards', label: 'In', icon: <ArrowDownToLine size={14} /> },
  { id: 'outwards', label: 'Out', icon: <ArrowUpFromLine size={14} /> },
  { id: 'wastage', label: 'Waste', icon: <Trash2 size={14} /> },
  { id: 'items', label: 'Settings', icon: <ListPlus size={14} /> },
  { id: 'reports', label: 'Reports', icon: <FileBarChart size={14} /> },
  { id: 'history', label: 'History', icon: <Archive size={14} /> },
  { id: 'admin', label: 'Admin', icon: <Shield size={14} /> },
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [inv, out, wst, ci, arch, vols] = await Promise.all([
      loadInwards(),
      loadOutwards(),
      loadWastage(),
      loadCustomItems(),
      loadArchive(),
      loadVolunteers(),
    ]);
    setInwards(inv);
    setOutwards(out);
    setWastage(wst);
    setCustomItems(ci);
    setArchive(arch);
    setVolunteers(vols);
  }, []);

  useEffect(() => {
    initDB().then(refresh).then(() => setLoading(false));
  }, [refresh]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleAddInward = async (item: string, category: string, qty: number, unit: string, donor: string, bestBefore: string, stor: StorageLocation, enteredBy?: string) => {
    let formattedBB = bestBefore;
    if (bestBefore && bestBefore.includes('-')) {
      const [y, m, d] = bestBefore.split('-');
      formattedBB = `${d}/${m}/${y}`;
    }
    await addInward(item, category, qty, unit, donor, formattedBB, stor, enteredBy || '');
    await refresh();
  };

  const handleTake = async (inwardId: string, qty: number, takenBy: string) => {
    await addOutward(inwardId, qty, takenBy);
    await refresh();
  };

  const handleAddWastage = async (inwardId: string, qty: number, reason: string, reportedBy: string, notes: string) => {
    await addWastage(inwardId, qty, reason, reportedBy, notes);
    await refresh();
  };

  const handleDeleteOutward = async (id: number) => { await deleteOutward(id); await refresh(); };
  const handleDeleteWastage = async (id: number) => { await deleteWastage(id); await refresh(); };
  const handleDeleteInward = async (id: string) => { await deleteInward(id); await refresh(); };

  const handleAddCustomItem = async (name: string, category: string) => {
    await addCustomItem(name, category);
    await refresh();
  };
  const handleDeleteCustomItem = async (id: number) => {
    await deleteCustomItem(id);
    await refresh();
  };

  // Archive completed items
  const handleArchive = async () => {
    const count = await archiveCompletedItems();
    await refresh();
    if (count > 0) {
      setArchiveMsg(`✅ Archived ${count} completed item${count !== 1 ? 's' : ''} to history`);
    } else {
      setArchiveMsg('ℹ️ No completed items to archive (all items still have remaining stock)');
    }
    setTimeout(() => setArchiveMsg(null), 4000);
  };

  const handleDeleteArchive = async (id: string) => {
    await deleteArchiveItem(id);
    await refresh();
  };

  // Admin actions
  const handleClearLive = async () => { await clearAllData(); await refresh(); };
  const handleClearArchive = async () => { await clearArchive(); await refresh(); };
  const handleClearEverything = async () => { await clearEverything(); await refresh(); };
  const handleImportInwards = async (csv: string): Promise<number> => {
    const count = await importInwardsFromCSV(csv);
    await refresh();
    return count;
  };
  const handleImportOutwards = async (csv: string): Promise<number> => {
    const count = await importOutwardsFromCSV(csv);
    await refresh();
    return count;
  };
  const handleImportWastage = async (csv: string): Promise<number> => {
    const count = await importWastageFromCSV(csv);
    await refresh();
    return count;
  };
  const handleImportItems = async (csv: string): Promise<number> => {
    const count = await importCustomItems(csv);
    await refresh();
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

      {/* Archive message */}
      {archiveMsg && (
        <div className="px-3 py-2 text-xs text-center bg-success/10 text-success font-medium">
          {archiveMsg}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex bg-base-200 border-b border-base-300 px-1 py-1 gap-0.5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all min-w-0 ${
              tab === t.id
                ? 'bg-white shadow-sm text-emerald-700 font-bold'
                : 'text-base-content/50 hover:bg-base-300'
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
          />
        )}
        {tab === 'inwards' && (
          <InwardsTab
            inwards={inwards} customItems={customItems}
            storage={storage} onStorageChange={setStorage}
            onAdd={handleAddInward} onDelete={handleDeleteInward}
          />
        )}
        {tab === 'outwards' && (
          <OutwardsTab
            inwards={inwards} outwards={outwards}
            storage={storage} onStorageChange={setStorage}
            onTake={handleTake} onDelete={handleDeleteOutward}
          />
        )}
        {tab === 'wastage' && (
          <WastageTab
            inwards={inwards} wastage={wastage}
            storage={storage} onStorageChange={setStorage}
            onAdd={handleAddWastage} onDelete={handleDeleteWastage}
          />
        )}
        {tab === 'items' && (
          <ItemsTab
            customItems={customItems}
            onAdd={handleAddCustomItem}
            onDelete={handleDeleteCustomItem}
            onImportItems={async (csv: string) => {
              const count = await importCustomItems(csv);
              await refresh();
              return count;
            }}
            volunteers={volunteers}
            onAddVolunteer={async (name: string, initials: string) => {
              await addVolunteer(name, initials);
              await refresh();
            }}
            onDeleteVolunteer={async (id: number) => {
              await deleteVolunteer(id);
              await refresh();
            }}
            onImportVolunteers={async (csv: string) => {
              const count = await importVolunteers(csv);
              await refresh();
              return count;
            }}
          />
        )}
        {tab === 'reports' && (
          <ReportsTab
            inwards={inwards} wastage={wastage} outwards={outwards}
            storage={storage} onStorageChange={setStorage}
            archive={archive} customItems={customItems}
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
          />
        )}
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
