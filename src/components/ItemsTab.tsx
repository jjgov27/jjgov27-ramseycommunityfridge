import React, { useState, useRef } from 'react';
import { CustomItem, Volunteer, CATEGORIES, REFERENCE_ITEMS, CATEGORY_COLOURS } from '../types';
import { Plus, Trash2, Search, Upload, FileDown, AlertTriangle, Users, User } from 'lucide-react';

interface ItemsTabProps {
  customItems: CustomItem[];
  onAdd: (name: string, category: string) => void;
  onDelete: (id: number) => void;
  onImportItems: (csv: string) => Promise<number>;
  volunteers: Volunteer[];
  onAddVolunteer: (name: string, initials: string) => void;
  onDeleteVolunteer: (id: number) => void;
  onImportVolunteers: (csv: string) => Promise<number>;
}

export const ItemsTab: React.FC<ItemsTabProps> = ({
  customItems, onAdd, onDelete, onImportItems,
  volunteers, onAddVolunteer, onDeleteVolunteer, onImportVolunteers,
}) => {
  // Items state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'custom' | 'builtin'>('custom');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Volunteers state
  const [volName, setVolName] = useState('');
  const [volInitials, setVolInitials] = useState('');
  const [volSearch, setVolSearch] = useState('');
  const [showVolImport, setShowVolImport] = useState(false);
  const [volImportText, setVolImportText] = useState('');
  const [volImporting, setVolImporting] = useState(false);
  const [volImportMsg, setVolImportMsg] = useState<string | null>(null);
  const [volConfirmReplace, setVolConfirmReplace] = useState(false);
  const volFileRef = useRef<HTMLInputElement>(null);

  // Section toggle
  const [section, setSection] = useState<'items' | 'volunteers'>('items');

  // Items handlers
  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), category);
    setName('');
    setCategory('Other');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImportText(ev.target?.result as string || ''); setConfirmReplace(false); };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    if (!confirmReplace) { setConfirmReplace(true); return; }
    setImporting(true);
    try {
      const count = await onImportItems(importText);
      setImportMsg(`✅ Imported ${count} items (existing items replaced)`);
      setImportText(''); setShowImport(false); setConfirmReplace(false);
    } catch (err) { setImportMsg(`❌ Import failed: ${String(err)}`); }
    setImporting(false);
    setTimeout(() => setImportMsg(null), 4000);
  };

  const handleExport = () => {
    const csvLines = ['Name,Category'];
    customItems.forEach(ci => csvLines.push(`"${ci.name}","${ci.category}"`));
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'custom-items.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Volunteer handlers
  const handleAddVol = () => {
    if (!volName.trim() || !volInitials.trim()) return;
    onAddVolunteer(volName.trim(), volInitials.trim());
    setVolName(''); setVolInitials('');
  };

  const handleVolFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setVolImportText(ev.target?.result as string || ''); setVolConfirmReplace(false); };
    reader.readAsText(file);
    if (volFileRef.current) volFileRef.current.value = '';
  };

  const handleVolImport = async () => {
    if (!volConfirmReplace) { setVolConfirmReplace(true); return; }
    setVolImporting(true);
    try {
      const count = await onImportVolunteers(volImportText);
      setVolImportMsg(`✅ Imported ${count} volunteers (existing replaced)`);
      setVolImportText(''); setShowVolImport(false); setVolConfirmReplace(false);
    } catch (err) { setVolImportMsg(`❌ Import failed: ${String(err)}`); }
    setVolImporting(false);
    setTimeout(() => setVolImportMsg(null), 4000);
  };

  const handleVolExport = () => {
    const csvLines = ['Name,Initials'];
    volunteers.forEach(v => csvLines.push(`"${v.name}","${v.initials}"`));
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'volunteers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Preview for item import
  const previewItems = importText ? (() => {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0]?.toLowerCase() || '';
    const hasHeader = firstLine.includes('name') || firstLine.includes('item') || firstLine.includes('category');
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.slice(0, 10).map(line => {
      const parts = line.match(/(\".*?\"|[^,]+)/g)?.map(p => p.replace(/^"|"$/g, '').trim()) || [];
      return { name: parts[0] || '', category: parts[1] || 'Other' };
    });
  })() : [];

  const totalImportLines = importText ? (() => {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0]?.toLowerCase() || '';
    const hasHeader = firstLine.includes('name') || firstLine.includes('item') || firstLine.includes('category');
    return hasHeader ? lines.length - 1 : lines.length;
  })() : 0;

  // Preview for volunteer import
  const previewVols = volImportText ? (() => {
    const lines = volImportText.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0]?.toLowerCase() || '';
    const hasHeader = firstLine.includes('name') || firstLine.includes('initial');
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.slice(0, 10).map(line => {
      const parts = line.match(/(\".*?\"|[^,]+)/g)?.map(p => p.replace(/^"|"$/g, '').trim()) || [];
      const n = parts[0] || '';
      const init = parts[1] || n.split(' ').map(w => w[0]).join('').toUpperCase();
      return { name: n, initials: init };
    });
  })() : [];

  const builtinList = Object.entries(REFERENCE_ITEMS)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([n]) => !search || n.toLowerCase().includes(search.toLowerCase()));

  const filteredCustom = customItems.filter(ci =>
    !search || ci.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredVols = volunteers.filter(v =>
    !volSearch || v.name.toLowerCase().includes(volSearch.toLowerCase()) || v.initials.toLowerCase().includes(volSearch.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white p-4">
        <h2 className="font-bold text-base">⚙️ Settings & Manage</h2>
        <p className="text-xs text-white/80 mt-1">Manage food items and volunteer initials. They'll appear as options in the entry forms.</p>
      </div>

      {/* Section toggle */}
      <div className="flex rounded-lg overflow-hidden border-2 border-violet-300">
        <button
          className={`flex-1 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${section === 'items' ? 'bg-violet-500 text-white' : 'bg-base-100 text-base-content/60 hover:bg-base-200'}`}
          onClick={() => setSection('items')}
        >
          📋 Food Items ({customItems.length})
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${section === 'volunteers' ? 'bg-teal-500 text-white' : 'bg-base-100 text-base-content/60 hover:bg-base-200'}`}
          onClick={() => setSection('volunteers')}
        >
          <Users size={14} /> Volunteers ({volunteers.length})
        </button>
      </div>

      {/* ============ ITEMS SECTION ============ */}
      {section === 'items' && (
        <div className="space-y-3">
          {importMsg && (
            <div className={`px-3 py-2 text-xs text-center font-medium rounded-lg ${importMsg.startsWith('✅') ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              {importMsg}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button className="btn btn-sm flex-1 bg-violet-500 hover:bg-violet-600 border-violet-600 text-white" onClick={() => setShowImport(!showImport)}>
              <Upload size={14} /> Import Items
            </button>
            {customItems.length > 0 && (
              <button className="btn btn-sm btn-outline border-violet-300 text-violet-600 hover:bg-violet-50" onClick={handleExport}>
                <FileDown size={14} /> Export
              </button>
            )}
          </div>

          {/* Import panel */}
          {showImport && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <h3 className="font-bold text-sm">📥 Import Items from CSV</h3>
              <p className="text-xs text-base-content/60">
                Format: <code className="bg-base-200 px-1 rounded">Name, Category</code> (one per line). All names auto-capitalised.
              </p>
              <div className="bg-base-200 rounded-lg p-2 text-xs font-mono">
                <div className="text-base-content/40 mb-1">Example:</div>
                <div>Baked Beans, Tinned Goods</div>
                <div>Wholemeal Bread, Bakery</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="file-input file-input-bordered file-input-sm w-full" onChange={handleFileUpload} />
              <textarea className="textarea textarea-bordered w-full text-xs font-mono h-28" placeholder="Or paste items here — one per line: Name, Category" value={importText} onChange={e => { setImportText(e.target.value); setConfirmReplace(false); }} />
              {previewItems.length > 0 && (
                <div className="bg-white rounded-lg border p-2 space-y-1">
                  <div className="text-xs font-bold text-violet-600">Preview ({totalImportLines} items{totalImportLines > 10 ? ', showing first 10' : ''}):</div>
                  {previewItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{item.name.replace(/\b\w/g, c => c.toUpperCase())}</span>
                      <span className="text-base-content/40">→</span>
                      <span className="text-violet-500">{item.category.replace(/\b\w/g, c => c.toUpperCase())}</span>
                    </div>
                  ))}
                </div>
              )}
              {customItems.length > 0 && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-warning">This will <strong>replace all {customItems.length} existing custom items</strong> with the imported list.</span>
                </div>
              )}
              <button className={`btn btn-sm w-full ${confirmReplace ? 'bg-red-500 hover:bg-red-600 border-red-600' : 'bg-violet-500 hover:bg-violet-600 border-violet-600'} text-white`} onClick={handleImport} disabled={!importText.trim() || importing}>
                {importing ? (<><span className="loading loading-spinner loading-xs" /> Importing...</>) : confirmReplace ? (<>⚠️ Click Again to Confirm Replace</>) : (<><Upload size={14} /> Import & Replace All Items</>)}
              </button>
              <button className="btn btn-ghost btn-xs w-full" onClick={() => { setShowImport(false); setImportText(''); setConfirmReplace(false); }}>Cancel</button>
            </div>
          )}

          {/* Add form */}
          <div className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-4 space-y-3">
            <h3 className="font-bold text-sm">➕ Add Custom Item</h3>
            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs font-medium">Item Name *</span></label>
              <input className="input input-bordered input-sm w-full bg-white" placeholder="e.g. Sourdough Bread, Hummus..." value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs font-medium">Category</span></label>
              <select className="select select-bordered select-sm w-full bg-white" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn btn-sm w-full bg-violet-500 hover:bg-violet-600 border-violet-600 text-white" onClick={handleAdd} disabled={!name.trim()}>
              <Plus size={16} /> Add Item
            </button>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-lg overflow-hidden border border-base-300">
            <button className={`flex-1 py-2 text-xs font-bold transition-all ${tab === 'custom' ? 'bg-violet-500 text-white' : 'bg-base-200 text-base-content/60'}`} onClick={() => setTab('custom')}>
              Your Items ({customItems.length})
            </button>
            <button className={`flex-1 py-2 text-xs font-bold transition-all ${tab === 'builtin' ? 'bg-violet-500 text-white' : 'bg-base-200 text-base-content/60'}`} onClick={() => setTab('builtin')}>
              Built-in ({Object.keys(REFERENCE_ITEMS).length})
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input className="input input-bordered input-sm w-full pl-8" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* List */}
          {tab === 'custom' ? (
            <div className="space-y-1">
              {filteredCustom.length === 0 ? (
                <div className="text-center text-base-content/60 py-6 text-sm">
                  {customItems.length === 0 ? "No custom items yet. Add your first one above or import a list!" : "No matches."}
                </div>
              ) : (
                filteredCustom.map(ci => {
                  const catColour = CATEGORY_COLOURS[ci.category] || CATEGORY_COLOURS['Other'];
                  return (
                    <div key={ci.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-base-200 transition-colors border-b border-base-200 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{ci.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${catColour}`}>{ci.category}</span>
                      </div>
                      <button className="btn btn-ghost btn-xs text-red-400 hover:text-red-600" onClick={() => onDelete(ci.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {builtinList.map(([itemName, cat]) => {
                const catColour = CATEGORY_COLOURS[cat] || CATEGORY_COLOURS['Other'];
                return (
                  <div key={itemName} className="flex items-center justify-between py-2 px-3 rounded-lg border-b border-base-200 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{itemName}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${catColour}`}>{cat}</span>
                    </div>
                    <span className="text-xs text-base-content/40">built-in</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ VOLUNTEERS SECTION ============ */}
      {section === 'volunteers' && (
        <div className="space-y-3">
          {volImportMsg && (
            <div className={`px-3 py-2 text-xs text-center font-medium rounded-lg ${volImportMsg.startsWith('✅') ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              {volImportMsg}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button className="btn btn-sm flex-1 bg-teal-500 hover:bg-teal-600 border-teal-600 text-white" onClick={() => setShowVolImport(!showVolImport)}>
              <Upload size={14} /> Import Volunteers
            </button>
            {volunteers.length > 0 && (
              <button className="btn btn-sm btn-outline border-teal-300 text-teal-600 hover:bg-teal-50" onClick={handleVolExport}>
                <FileDown size={14} /> Export
              </button>
            )}
          </div>

          {/* Import panel */}
          {showVolImport && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <h3 className="font-bold text-sm">📥 Import Volunteers from CSV</h3>
              <p className="text-xs text-base-content/60">
                Format: <code className="bg-base-200 px-1 rounded">Name, Initials</code> (one per line). If initials omitted, auto-generated from name.
              </p>
              <div className="bg-base-200 rounded-lg p-2 text-xs font-mono">
                <div className="text-base-content/40 mb-1">Example:</div>
                <div>Jane Smith, JS</div>
                <div>Tom Brown, TB</div>
                <div>Sarah Davies, SD</div>
              </div>
              <input ref={volFileRef} type="file" accept=".csv,.txt" className="file-input file-input-bordered file-input-sm w-full" onChange={handleVolFileUpload} />
              <textarea className="textarea textarea-bordered w-full text-xs font-mono h-28" placeholder="Or paste volunteers here — one per line: Name, Initials" value={volImportText} onChange={e => { setVolImportText(e.target.value); setVolConfirmReplace(false); }} />
              {previewVols.length > 0 && (
                <div className="bg-white rounded-lg border p-2 space-y-1">
                  <div className="text-xs font-bold text-teal-600">Preview ({previewVols.length} shown):</div>
                  {previewVols.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{v.name}</span>
                      <span className="text-base-content/40">→</span>
                      <span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-bold text-xs">{v.initials}</span>
                    </div>
                  ))}
                </div>
              )}
              {volunteers.length > 0 && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-warning">This will <strong>replace all {volunteers.length} existing volunteers</strong> with the imported list.</span>
                </div>
              )}
              <button className={`btn btn-sm w-full ${volConfirmReplace ? 'bg-red-500 hover:bg-red-600 border-red-600' : 'bg-teal-500 hover:bg-teal-600 border-teal-600'} text-white`} onClick={handleVolImport} disabled={!volImportText.trim() || volImporting}>
                {volImporting ? (<><span className="loading loading-spinner loading-xs" /> Importing...</>) : volConfirmReplace ? (<>⚠️ Click Again to Confirm Replace</>) : (<><Upload size={14} /> Import & Replace All Volunteers</>)}
              </button>
              <button className="btn btn-ghost btn-xs w-full" onClick={() => { setShowVolImport(false); setVolImportText(''); setVolConfirmReplace(false); }}>Cancel</button>
            </div>
          )}

          {/* Add form */}
          <div className="rounded-xl border-2 border-teal-200 bg-teal-50/50 p-4 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-1.5"><User size={14} /> Add Volunteer</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="form-control">
                <label className="label py-0.5"><span className="label-text text-xs font-medium">Full Name *</span></label>
                <input className="input input-bordered input-sm w-full bg-white" placeholder="e.g. Jane Smith" value={volName} onChange={e => setVolName(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label py-0.5"><span className="label-text text-xs font-medium">Initials *</span></label>
                <input className="input input-bordered input-sm w-full bg-white uppercase" placeholder="e.g. JS" value={volInitials} onChange={e => setVolInitials(e.target.value.toUpperCase())} maxLength={5} />
              </div>
            </div>
            <button className="btn btn-sm w-full bg-teal-500 hover:bg-teal-600 border-teal-600 text-white" onClick={handleAddVol} disabled={!volName.trim() || !volInitials.trim()}>
              <Plus size={16} /> Add Volunteer
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input className="input input-bordered input-sm w-full pl-8" placeholder="Search volunteers..." value={volSearch} onChange={e => setVolSearch(e.target.value)} />
          </div>

          {/* Volunteers list */}
          <div className="space-y-1">
            {filteredVols.length === 0 ? (
              <div className="text-center text-base-content/60 py-6 text-sm">
                {volunteers.length === 0 ? "No volunteers yet. Add your first one above or import a list!" : "No matches."}
              </div>
            ) : (
              filteredVols.map(v => (
                <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-base-200 transition-colors border-b border-base-200 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded font-bold text-xs min-w-[2rem] text-center">{v.initials}</span>
                    <span className="font-medium text-sm">{v.name}</span>
                  </div>
                  <button className="btn btn-ghost btn-xs text-red-400 hover:text-red-600" onClick={() => onDeleteVolunteer(v.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
