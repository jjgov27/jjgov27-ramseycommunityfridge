import React, { useState, useRef } from 'react';
import { AlertTriangle, Trash2, Upload, Shield, Database, FileUp, Package, ArrowDownToLine, CircleAlert, Utensils } from 'lucide-react';

type ImportType = 'inwards' | 'outwards' | 'wastage' | 'items';

const IMPORT_CONFIG: Record<ImportType, { label: string; icon: React.ReactNode; colour: string; description: string; template: string; example: string }> = {
  inwards: {
    label: '📥 Inwards (In)',
    icon: <ArrowDownToLine size={14} />,
    colour: 'btn-success',
    description: 'Import stock received. Uses your spreadsheet headers: Date, Time, Qty, Description, Current Location, Expiry Date, Initials.',
    template: 'Date,Time,Qty,Description,Current Location,Expiry Date,Initials',
    example: '15/04/2025,09:00,3,Whole Milk,Fridge,20/04/2025,JD',
  },
  outwards: {
    label: '📤 Outwards (Out)',
    icon: <Package size={14} />,
    colour: 'btn-info',
    description: 'Import items handed out. Requires "inward_id" column. Tip: import Inwards first so IDs link up.',
    template: 'inward_id,qty_taken,date_taken,time_taken,taken_by',
    example: 'CF-001,1,16/04/2025,10:30,Community Member',
  },
  wastage: {
    label: '🗑️ Wastage',
    icon: <CircleAlert size={14} />,
    colour: 'btn-warning',
    description: 'Import waste records. Requires "inward_id" column. Tip: import Inwards first so IDs link up.',
    template: 'inward_id,qty_wasted,reason,date_wasted,reported_by,notes',
    example: 'CF-001,2,Past Expiry,17/04/2025,Sarah,Found mouldy',
  },
  items: {
    label: '🍎 Custom Items',
    icon: <Utensils size={14} />,
    colour: 'btn-accent',
    description: 'Import custom food items list. Replaces ALL existing custom items. Names auto-capitalised.',
    template: 'name,category',
    example: 'Sourdough Bread,Bakery',
  },
};

interface AdminTabProps {
  onClearLive: () => Promise<void>;
  onClearArchive: () => Promise<void>;
  onClearEverything: () => Promise<void>;
  onImportInwards: (csv: string) => Promise<number>;
  onImportOutwards: (csv: string) => Promise<number>;
  onImportWastage: (csv: string) => Promise<number>;
  onImportItems: (csv: string) => Promise<number>;
}

export const AdminTab: React.FC<AdminTabProps> = ({
  onClearLive, onClearArchive, onClearEverything,
  onImportInwards, onImportOutwards, onImportWastage, onImportItems,
}) => {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedImport, setSelectedImport] = useState<ImportType>('inwards');
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleAction = async (action: string, fn: () => Promise<void | number>) => {
    if (confirmAction !== action) {
      setConfirmAction(action);
      return;
    }
    setBusy(true);
    setConfirmAction(null);
    try {
      await fn();
      showMessage('success', `${action} completed successfully!`);
    } catch (err) {
      showMessage('error', `Failed: ${String(err)}`);
    }
    setBusy(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportPreview(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getImportFn = (): ((csv: string) => Promise<number>) => {
    switch (selectedImport) {
      case 'inwards': return onImportInwards;
      case 'outwards': return onImportOutwards;
      case 'wastage': return onImportWastage;
      case 'items': return onImportItems;
    }
  };

  const handleImport = async () => {
    if (!importPreview) return;
    setBusy(true);
    try {
      const fn = getImportFn();
      const count = await fn(importPreview);
      const label = selectedImport === 'items' ? 'item' : 'record';
      showMessage('success', `Imported ${count} ${label}${count !== 1 ? 's' : ''} into ${IMPORT_CONFIG[selectedImport].label}!`);
      setImportPreview(null);
    } catch (err) {
      showMessage('error', `Import failed: ${String(err)}`);
    }
    setBusy(false);
  };

  const previewLines = importPreview ? importPreview.trim().split('\n') : [];
  const cfg = IMPORT_CONFIG[selectedImport];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield size={18} className="text-primary" />
        <h2 className="font-bold text-base">Admin / Import & Test Mode</h2>
      </div>

      {/* Status message */}
      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'} text-sm py-2`}>
          {message.text}
        </div>
      )}

      {/* ========== IMPORT SECTION ========== */}
      <div className="card bg-base-200">
        <div className="card-body p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-info" />
            <h3 className="font-semibold text-sm">Import Data (CSV)</h3>
          </div>

          {/* Import Type Selector */}
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(IMPORT_CONFIG) as ImportType[]).map(type => (
              <button
                key={type}
                className={`btn btn-sm ${selectedImport === type ? IMPORT_CONFIG[type].colour : 'btn-ghost border-base-300'} text-xs justify-start gap-1`}
                onClick={() => { setSelectedImport(type); setImportPreview(null); }}
              >
                {IMPORT_CONFIG[type].icon} {IMPORT_CONFIG[type].label}
              </button>
            ))}
          </div>

          {/* Selected import description */}
          <div className="bg-base-300 rounded-lg p-3">
            <p className="text-xs text-base-content/70 mb-2">{cfg.description}</p>
            <div className="text-xs">
              <p className="font-semibold mb-1">CSV Template:</p>
              <code className="bg-base-100 px-2 py-1 rounded block text-xs">{cfg.template}</code>
              <code className="bg-base-100 px-2 py-1 rounded block mt-1 text-xs text-base-content/60">{cfg.example}</code>
            </div>
          </div>

          {/* File Upload Button */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button className="btn btn-sm btn-outline btn-info" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <FileUp size={14} /> Choose CSV File for {cfg.label}
            </button>
          </div>

          {/* Preview */}
          {importPreview && (
            <div className="space-y-2">
              <p className="text-xs font-semibold">Preview — importing into {cfg.label} ({previewLines.length - 1} rows):</p>
              <div className="bg-base-300 rounded p-2 max-h-40 overflow-auto text-xs font-mono">
                {previewLines.slice(0, 8).map((line, i) => (
                  <div key={i} className={i === 0 ? 'font-bold text-primary' : ''}>{line}</div>
                ))}
                {previewLines.length > 8 && <div className="text-base-content/50">... {previewLines.length - 8} more rows</div>}
              </div>
              <div className="flex gap-2">
                <button className={`btn btn-sm ${cfg.colour}`} onClick={handleImport} disabled={busy}>
                  {busy ? <span className="loading loading-spinner loading-xs" /> : <Upload size={14} />}
                  Import {previewLines.length - 1} Records
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setImportPreview(null)} disabled={busy}>Cancel</button>
              </div>
              {selectedImport === 'items' && (
                <p className="text-xs text-warning">⚠️ This will replace ALL existing custom items!</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========== TEST MODE — CLEAR BUTTONS ========== */}
      <div className="card bg-base-200 border border-error/20">
        <div className="card-body p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-error" />
            <h3 className="font-semibold text-sm text-error">Test Mode — Clear Data</h3>
          </div>
          <p className="text-xs text-base-content/60">
            Use these during testing to reset data. Click once to see the confirmation, click again to execute. These actions cannot be undone!
          </p>

          <div className="space-y-2">
            {/* Clear live data */}
            <div className="flex items-center justify-between bg-base-300 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Clear Live Data</p>
                <p className="text-xs text-base-content/50">Removes all inwards, outwards & wastage. Resets ID counter. Keeps archive & custom items.</p>
              </div>
              <button
                className={`btn btn-sm ${confirmAction === 'clear-live' ? 'btn-error' : 'btn-outline btn-error'}`}
                onClick={() => handleAction('clear-live', onClearLive)}
                disabled={busy}
              >
                {busy ? <span className="loading loading-spinner loading-xs" /> : <Trash2 size={14} />}
                {confirmAction === 'clear-live' ? 'Confirm?' : 'Clear'}
              </button>
            </div>

            {/* Clear archive */}
            <div className="flex items-center justify-between bg-base-300 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Clear Archive / History</p>
                <p className="text-xs text-base-content/50">Removes all archived history records. Keeps live data & custom items.</p>
              </div>
              <button
                className={`btn btn-sm ${confirmAction === 'clear-archive' ? 'btn-error' : 'btn-outline btn-error'}`}
                onClick={() => handleAction('clear-archive', onClearArchive)}
                disabled={busy}
              >
                {busy ? <span className="loading loading-spinner loading-xs" /> : <Database size={14} />}
                {confirmAction === 'clear-archive' ? 'Confirm?' : 'Clear'}
              </button>
            </div>

            {/* Nuclear option */}
            <div className="flex items-center justify-between bg-error/10 rounded-lg p-3 border border-error/30">
              <div>
                <p className="text-sm font-medium text-error">⚠️ Clear EVERYTHING</p>
                <p className="text-xs text-base-content/50">Removes ALL data: live, archive, and custom items. Total reset.</p>
              </div>
              <button
                className={`btn btn-sm ${confirmAction === 'clear-all' ? 'btn-error' : 'btn-outline btn-error'}`}
                onClick={() => handleAction('clear-all', onClearEverything)}
                disabled={busy}
              >
                {busy ? <span className="loading loading-spinner loading-xs" /> : <AlertTriangle size={14} />}
                {confirmAction === 'clear-all' ? 'CONFIRM?' : 'Reset All'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
