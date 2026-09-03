import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Upload,
} from 'lucide-react';
import {
  fetchActiveLotLocations,
  fetchItemsBySku,
  fetchSheetCsv,
  createRawMaterialItem,
  upsertFifoSettings,
  receiveMaterial,
  resetItemLots,
} from '../api/materialFifoApi';
import { parseMigrationSheet } from '../lib/parseMigrationSheet';
import {
  EmptyState,
  PageHeader,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/MaterialFifoUi';

// ─── Status helpers ─────────────────────────────────────────────────────────

const STATUS = {
  NEW: 'new',       // SKU belum ada di Supabase
  UPDATE: 'update', // SKU sudah ada di Supabase
  ERROR: 'error',   // Data tidak valid
};

function itemStatus(item) {
  if (!item.valid) return STATUS.ERROR;
  return item.isNew ? STATUS.NEW : STATUS.UPDATE;
}

const STATUS_STYLE = {
  [STATUS.NEW]: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Baru' },
  [STATUS.UPDATE]: { badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Update' },
  [STATUS.ERROR]: { badge: 'bg-red-50 text-red-700 border-red-200', label: 'Error' },
};

// ─── Result status per item selama proses ────────────────────────────────────

const PROC = {
  PENDING: 'pending',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionTitle = ({ children }) => (
  <h3 className="text-sm font-bold text-slate-900">{children}</h3>
);

const Alert = ({ type = 'info', children }) => {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  const Icon = { info: Info, warning: AlertTriangle, error: AlertTriangle, success: CheckCircle2 }[type];
  return (
    <div role="alert" className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${styles[type]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
};

const StepBadge = ({ n, active, done }) => (
  <span
    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold
      ${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}
  >
    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
  </span>
);

const ProgressBar = ({ value, max, color = 'bg-blue-500' }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
    <div
      className={`h-full rounded-full transition-all duration-300 ${color}`}
      style={{ width: max ? `${Math.min(100, (value / max) * 100)}%` : '0%' }}
    />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const MigrationPage = () => {
  // Step: 'source' | 'preview' | 'process' | 'done'
  const [step, setStep] = useState('source');

  // Source mode: 'upload' | 'url'
  const [mode, setMode] = useState('upload');
  const [sheetUrl, setSheetUrl] = useState('');
  const [headerRow, setHeaderRow] = useState('1'); // baris header di sheet (1-based)
  const fileRef = useRef(null);

  // Loading & error
  const [loading, setLoading] = useState(false);
  const [sourceError, setSourceError] = useState('');

  // Parsed preview
  const [parsed, setParsed] = useState(null); // { items, validItems, invalidItems, missingHeaders }

  // Expand state per item di preview
  const [expandedSkus, setExpandedSkus] = useState(new Set());

  // Process mode: 'replace' (default/sync) | 'append' | 'skip'
  const [processMode, setProcessMode] = useState('replace');
  const [resetConfirmed, setResetConfirmed] = useState(false);

  // Process results: Map<sku, {status, message, lotsOk, lotsFail}>
  const [results, setResults] = useState(new Map());
  const [processRunning, setProcessRunning] = useState(false);
  const [processProgress, setProcessProgress] = useState({ done: 0, total: 0 });

  // ── Load dari file ─────────────────────────────────────────────────────────
  const loadFile = async (file) => {
    setSourceError('');
    setParsed(null);
    setResults(new Map());
    setStep('source');
    if (!file) return;
    setLoading(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, raw: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
      await buildPreview(rows);
    } catch (err) {
      setSourceError(`Gagal membaca file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Load dari URL ──────────────────────────────────────────────────────────
  const loadUrl = async () => {
    setSourceError('');
    setParsed(null);
    setResults(new Map());
    setStep('source');
    if (!sheetUrl.trim()) { setSourceError('URL tidak boleh kosong.'); return; }
    setLoading(true);
    try {
      const rows = await fetchSheetCsv(sheetUrl.trim());
      await buildPreview(rows);
    } catch (err) {
      setSourceError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Build preview: parse + cek SKU existing ────────────────────────────────
  const buildPreview = async (rawRows) => {
    // Potong baris kosong di atas sesuai headerRow yang dipilih user
    const startIdx = Math.max(0, Number(headerRow) - 1);
    const rows = rawRows.slice(startIdx);

    // Parse tanpa info existing dulu (cepat)
    const quickParsed = parseMigrationSheet(rows, []);
    if (quickParsed.missingHeaders.length) {
      setSourceError(
        `Header wajib tidak ditemukan: ${quickParsed.missingHeaders.join(', ')}. ` +
        'Pastikan baris header sudah benar dan sesuai format.'
      );
      return;
    }

    // Cek SKU mana yang sudah ada di Supabase
    const skus = quickParsed.items.map((i) => i.sku);
    const existingMap = await fetchItemsBySku(skus);
    const existingItems = [...existingMap.values()];

    // Parse ulang dengan info existing
    const finalParsed = parseMigrationSheet(rows, existingItems);
    setParsed(finalParsed);
    setExpandedSkus(new Set());
    setStep('preview');
  };

  // ── Proses migrasi ─────────────────────────────────────────────────────────
  const runMigration = async () => {
    if (!parsed?.validItems.length || processRunning) return;

    setProcessRunning(true);
    setResults(new Map());
    setStep('process');
    const total = parsed.validItems.length;
    setProcessProgress({ done: 0, total });

    const newResults = new Map();

    for (let i = 0; i < parsed.validItems.length; i++) {
      const item = parsed.validItems[i];
      newResults.set(item.sku, { status: PROC.RUNNING, message: 'Memproses...', lotsOk: 0, lotsFail: 0, lotDetails: [] });
      setResults(new Map(newResults));

      try {
        // 1. Buat SKU baru di Supabase jika belum ada
        let itemId;
        if (item.isNew) {
          const created = await createRawMaterialItem({
            sku: item.sku,
            itemCode: item.code,
            internalProductCode: item.internalProductCode,
            itemName: item.name,
            uom: item.uom,
          });
          itemId = created?.id ?? created;
        } else {
          itemId = item.existingItem.id;
        }

        // 2. Upsert MIN/MAX (aman dijalankan berulang)
        if (item.min !== undefined || item.max !== undefined) {
          await upsertFifoSettings({
            itemId,
            minQty: String(item.min ?? 0),
            maxQty: String(item.max ?? 0),
            remarks: '',
          });
        }

        // 3. Proses lot FIFO
        let lotsOk = 0;
        let lotsFail = 0;
        const lotDetails = [];

        // Mode REPLACE: Kosongkan stok lama terlebih dahulu sebelum input lot baru
        if (processMode === 'replace' && !item.isNew) {
          try {
            const clearedStock = await resetItemLots(itemId, 'Ganti stok dari Google Sheet');
            if (clearedStock > 0) {
              lotDetails.push({ loc: 'RESET', status: PROC.DONE, message: `Stok lama (${clearedStock} ${item.uom}) dikosongkan` });
            }
          } catch (resetErr) {
            throw new Error(`Gagal mengosongkan stok lama: ${resetErr.message}`);
          }
        }

        if (item.lots.length > 0) {
          // Ambil lokasi yang sudah ada (hanya jika mode skip)
          const existingLocs = processMode === 'skip' ? await fetchActiveLotLocations(itemId) : new Set();

          for (const lot of item.lots) {
            const locUpper = lot.loc.toUpperCase();
            if (processMode === 'skip' && existingLocs.has(locUpper)) {
              lotDetails.push({ loc: lot.loc, status: PROC.SKIPPED, message: 'Sudah ada di rak, dilewati' });
              continue;
            }
            try {
              await receiveMaterial({
                itemId,
                location: lot.loc,
                quantity: String(lot.qty),
                receivedDate: lot.tanggal,
                notes: 'Import migrasi dari Google Sheet',
                requestId: crypto.randomUUID(),
              });
              lotsOk++;
              lotDetails.push({ loc: lot.loc, status: PROC.DONE, message: `${lot.qty} ${item.uom} · ${lot.tanggal}` });
            } catch (lotErr) {
              lotsFail++;
              lotDetails.push({ loc: lot.loc, status: PROC.FAILED, message: lotErr.message });
            }
          }
        }

        newResults.set(item.sku, {
          status: PROC.DONE,
          message: item.isNew
            ? 'SKU baru berhasil dibuat'
            : processMode === 'replace'
            ? 'Data stok berhasil diganti'
            : 'SKU sudah ada, data diperbarui',
          lotsOk,
          lotsFail,
          lotDetails,
        });
      } catch (err) {
        newResults.set(item.sku, {
          status: PROC.FAILED,
          message: err.message,
          lotsOk: 0,
          lotsFail: 0,
          lotDetails: [],
        });
      }

      setResults(new Map(newResults));
      setProcessProgress({ done: i + 1, total });
    }

    setProcessRunning(false);
    setStep('done');
  };

  // ── Reset untuk mulai ulang ────────────────────────────────────────────────
  const resetAll = () => {
    setStep('source');
    setParsed(null);
    setResults(new Map());
    setSourceError('');
    setSheetUrl('');
    setProcessMode('replace');
    setResetConfirmed(false);
    setProcessProgress({ done: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Summary ────────────────────────────────────────────────────────────────
  const resultSummary = (() => {
    if (!results.size) return null;
    let done = 0, failed = 0, skippedLots = 0, okLots = 0;
    for (const r of results.values()) {
      if (r.status === PROC.DONE) done++;
      if (r.status === PROC.FAILED) failed++;
      okLots += r.lotsOk;
      skippedLots += (r.lotDetails?.filter((l) => l.status === PROC.SKIPPED).length ?? 0);
    }
    return { done, failed, okLots, skippedLots };
  })();

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-5">
      <PageHeader
        title="Migrasi dari Google Sheet"
        description="Import data SKU, MIN/MAX, dan lot FIFO dari sistem lama (Google Sheet) ke Supabase."
      >
        {step !== 'source' && (
          <button type="button" onClick={resetAll} className={secondaryButtonClass}>
            <RotateCcw className="h-3.5 w-3.5" /> Mulai Ulang
          </button>
        )}
      </PageHeader>

      {/* ── Step indicators ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-2xl border border-blue-100/80 bg-white/80 px-5 py-4 shadow-md shadow-blue-100/30">
        {[['Sumber Data', 'source'], ['Preview', 'preview'], ['Proses', 'process']].map(([label, s], idx) => {
          const active = step === s || (s === 'process' && step === 'done');
          const done = ['source', 'preview', 'process', 'done'].indexOf(step) > ['source', 'preview', 'process', 'done'].indexOf(s);
          return (
            <React.Fragment key={s}>
              {idx > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />}
              <div className="flex items-center gap-2">
                <StepBadge n={idx + 1} active={active} done={done} />
                <span className={`text-xs font-semibold ${active ? 'text-slate-900' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Step 1: Sumber Data ─────────────────────────────────────────── */}
      {step === 'source' && (
        <Panel ariaLabel="Sumber data" className="space-y-5 p-5">
          <SectionTitle>Pilih sumber data</SectionTitle>

          {/* Tab: Upload / URL */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[['upload', <Upload key="u" className="h-3.5 w-3.5" />, 'Upload File'],
              ['url', <Link2 key="l" className="h-3.5 w-3.5" />, 'Google Sheet URL']].map(([m, icon, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setSourceError(''); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition
                  ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Header row selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Header ada di baris ke:
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={headerRow}
              onChange={(e) => setHeaderRow(e.target.value)}
              className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-[11px] text-slate-400">
              (default: 1 — sesuaikan jika ada baris judul/logo di atas header kolom)
            </p>
          </div>

          {/* Upload mode */}
          {mode === 'upload' && (
            <div className="space-y-3">
              <Alert type="info">
                Export Google Sheet ke <strong>format .xlsx atau .csv</strong>, lalu upload di sini.
                Pastikan tab yang berisi data FIFO adalah tab pertama di file.
              </Alert>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Pilih file (.xlsx, .xls, .csv)</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => loadFile(e.target.files?.[0])}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </div>
          )}

          {/* URL mode */}
          {mode === 'url' && (
            <div className="space-y-3">
              <Alert type="info">
                Buka Google Sheet → <strong>File → Share → Publish to web</strong> → pilih tab data &amp; format CSV → salin URL-nya dan paste di sini.
              </Alert>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={loadUrl}
                  disabled={loading}
                  className={primaryButtonClass}
                >
                  {loading
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Mengambil...</>
                    : <><Download className="h-3.5 w-3.5" /> Ambil Data</>
                  }
                </button>
              </div>
            </div>
          )}

          {loading && mode === 'upload' && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Membaca dan menganalisis data...
            </div>
          )}

          {sourceError && <Alert type="error">{sourceError}</Alert>}
        </Panel>
      )}

      {/* ── Step 2: Preview ─────────────────────────────────────────────── */}
      {step === 'preview' && parsed && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'SKU Baru', value: parsed.items.filter((i) => i.valid && i.isNew).length, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
              { label: 'SKU Update', value: parsed.items.filter((i) => i.valid && !i.isNew).length, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
              { label: 'SKU Error', value: parsed.invalidItems.length, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-2xl border px-4 py-3 text-center ${bg}`}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className={`text-[11px] font-medium ${color} opacity-80`}>{label}</p>
              </div>
            ))}
          </div>

          {parsed.invalidItems.length > 0 && (
            <Alert type="warning">
              <strong>{parsed.invalidItems.length} SKU memiliki error</strong> dan tidak akan diproses.
              Perbaiki data di Google Sheet lalu upload ulang, atau lanjutkan untuk memproses yang valid saja.
            </Alert>
          )}

          {/* Daftar item */}
          <Panel ariaLabel="Preview item" className="divide-y divide-slate-100 overflow-hidden">
            {parsed.items.length === 0 && (
              <EmptyState>Tidak ada item yang ditemukan di sheet.</EmptyState>
            )}
            {parsed.items.map((item) => {
              const status = itemStatus(item);
              const style = STATUS_STYLE[status];
              const isExpanded = expandedSkus.has(item.sku);
              const toggleExpand = () => setExpandedSkus((prev) => {
                const next = new Set(prev);
                next.has(item.sku) ? next.delete(item.sku) : next.add(item.sku);
                return next;
              });
              return (
                <div key={item.sku} className="text-xs">
                  <button
                    type="button"
                    onClick={toggleExpand}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    <span className="font-mono font-semibold text-slate-800">{item.sku}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">{item.name}</span>
                    <span className="text-slate-400">{item.lots.length} lot</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                      {style.label}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-6 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4 text-[11px]">
                        <div><span className="text-slate-400">Kode:</span> <span className="font-medium text-slate-700">{item.code}</span></div>
                        <div><span className="text-slate-400">UOM:</span> <span className="font-medium text-slate-700">{item.uom}</span></div>
                        <div><span className="text-slate-400">MIN:</span> <span className="font-medium text-slate-700">{item.min}</span></div>
                        <div><span className="text-slate-400">MAX:</span> <span className="font-medium text-slate-700">{item.max}</span></div>
                      </div>
                      {item.lots.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.lots.map((lot) => (
                            <span
                              key={lot.loc}
                              className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 font-mono text-[10px] text-indigo-700"
                            >
                              {lot.loc} · {lot.qty} {item.uom} · {lot.tanggal}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">Tidak ada lot aktif</p>
                      )}
                      {!item.valid && item.errors.length > 0 && (
                        <ul className="space-y-1">
                          {item.errors.map((e, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[11px] text-red-600">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Panel>

          {/* Opsi proses */}
          {parsed.validItems.length > 0 && (
            <Panel ariaLabel="Opsi migrasi" className="space-y-4 p-5">
              <SectionTitle>Opsi sinkronisasi stok</SectionTitle>
              <div className="space-y-2">
                {[
                  ['replace', 'Ganti Stok (Replace / Sync) — Direkomendasikan', 'Sisa stok lama untuk SKU ini di Supabase akan dikosongkan dan digantikan dengan data lot terkini dari file. Rak lama yang sudah tidak ada di file akan dihapus, sehingga stok sama persis dengan file.'],
                  ['append', 'Tambah Stok (Append)', 'Lot baru dari file akan ditambahkan ke rak yang sudah ada di Supabase tanpa menghapus lot lama (menambah total stok).'],
                  ['skip', 'Lewati jika rak sudah terisi (Skip)', 'Jika lokasi rak sudah ada stok aktif di Supabase, lot baru untuk lokasi tersebut akan dilewati.'],
                ].map(([val, label, desc]) => (
                  <label key={val} className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${processMode === val ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <input
                      type="radio"
                      name="processMode"
                      value={val}
                      checked={processMode === val}
                      onChange={() => setProcessMode(val)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{label}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={runMigration}
                  disabled={processRunning}
                  className={primaryButtonClass}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Mulai Import {parsed.validItems.length} SKU Valid
                </button>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ── Step 3: Proses & Step 4: Done ──────────────────────────────── */}
      {(step === 'process' || step === 'done') && (
        <div className="space-y-4">
          {/* Progress */}
          {step === 'process' && (
            <Panel ariaLabel="Progress migrasi" className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <SectionTitle>Memproses migrasi...</SectionTitle>
                <span className="text-xs text-slate-500">
                  {processProgress.done} / {processProgress.total} SKU
                </span>
              </div>
              <ProgressBar value={processProgress.done} max={processProgress.total} />
            </Panel>
          )}

          {/* Summary setelah selesai */}
          {step === 'done' && resultSummary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'SKU Berhasil', value: resultSummary.done, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                { label: 'SKU Gagal', value: resultSummary.failed, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
                { label: 'Lot Ditambah', value: resultSummary.okLots, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                { label: 'Lot Dilewati', value: resultSummary.skippedLots, color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-2xl border px-4 py-3 text-center ${bg}`}>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className={`text-[11px] font-medium ${color} opacity-80`}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {step === 'done' && resultSummary?.failed === 0 && (
            <Alert type="success">
              🎉 <strong>Migrasi selesai!</strong> Semua SKU berhasil diimport ke Supabase.
              Cek halaman <strong>Data FIFO</strong> untuk memverifikasi data.
            </Alert>
          )}
          {step === 'done' && resultSummary?.failed > 0 && (
            <Alert type="warning">
              <strong>{resultSummary.failed} SKU gagal</strong> diimport. Lihat detail di bawah.
              SKU yang gagal bisa dicoba ulang setelah penyebabnya diperbaiki.
            </Alert>
          )}

          {/* Hasil per SKU */}
          <Panel ariaLabel="Hasil migrasi per SKU" className="divide-y divide-slate-100 overflow-hidden">
            {parsed?.validItems.map((item) => {
              const r = results.get(item.sku);
              if (!r) return null;
              const isRunning = r.status === PROC.RUNNING;
              const isDone = r.status === PROC.DONE;
              const isFailed = r.status === PROC.FAILED;
              const isPending = r.status === PROC.PENDING;
              const isExpanded = expandedSkus.has(`result-${item.sku}`);
              const toggleExpand = () => setExpandedSkus((prev) => {
                const next = new Set(prev);
                const key = `result-${item.sku}`;
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              });
              return (
                <div key={item.sku} className="text-xs">
                  <button
                    type="button"
                    onClick={toggleExpand}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full
                      ${isRunning ? 'animate-pulse bg-blue-400'
                        : isDone ? 'bg-emerald-400'
                        : isFailed ? 'bg-red-400'
                        : 'bg-slate-200'}`}
                    />
                    <span className="font-mono font-semibold text-slate-800">{item.sku}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">{r.message}</span>
                    {isDone && r.lotsOk > 0 && (
                      <span className="shrink-0 text-[11px] text-emerald-600">+{r.lotsOk} lot</span>
                    )}
                    {r.lotDetails?.length > 0 && (
                      <ChevronDown className={`h-3 w-3 shrink-0 text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  {isExpanded && r.lotDetails?.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-6 pb-3 pt-2 space-y-1">
                      {r.lotDetails.map((ld, idx) => (
                        <div key={idx} className={`flex items-center gap-2 text-[11px]
                          ${ld.status === PROC.DONE ? 'text-emerald-700'
                            : ld.status === PROC.SKIPPED ? 'text-slate-400'
                            : 'text-red-600'}`}
                        >
                          <span className="font-mono font-medium">{ld.loc}</span>
                          <span className="text-slate-300">·</span>
                          <span>{ld.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Panel>

          {step === 'done' && (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetAll} className={secondaryButtonClass}>
                <RefreshCw className="h-3.5 w-3.5" /> Import Ulang
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default MigrationPage;
