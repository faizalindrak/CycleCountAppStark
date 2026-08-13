import React, { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { issueMaterial, upsertFifoSettings } from '../api/materialFifoApi';
import { FieldLabel, inputClass, PageHeader, Panel, primaryButtonClass, secondaryButtonClass } from '../components/MaterialFifoUi';
import { localDateInput } from '../lib/dates';
import { parseMinMaxRows, parseOutboundRows } from '../lib/importRows';

const ImportPage = (props) => {
  const outlet = useOutletContext() ?? {};
  const materials = props.materials ?? outlet.materials ?? [];
  const refresh = props.refresh ?? outlet.refresh ?? (() => Promise.resolve());
  const [kind, setKind] = useState('OUTBOUND');
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [fileError, setFileError] = useState('');
  const importIdentity = useRef(null);

  const downloadTemplate = () => {
    const outbound = kind === 'OUTBOUND';
    const sheet = XLSX.utils.aoa_to_sheet([outbound ? ['SKU', 'QTY', 'LOKASI'] : ['SKU', 'MIN', 'MAX']]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, outbound ? 'Barang Keluar' : 'MIN MAX');
    XLSX.writeFile(workbook, outbound ? 'template_barang_keluar_fifo.xlsx' : 'template_min_max_fifo.xlsx');
  };

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    setPreview(null); setResults([]); setFileError('');
    importIdentity.current = null;
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
      const parsed = kind === 'OUTBOUND' ? parseOutboundRows(rows, materials) : parseMinMaxRows(rows, materials);
      setPreview(parsed);
      if (kind === 'OUTBOUND') {
        importIdentity.current = {
          batchId: crypto.randomUUID(),
          requestIds: Object.fromEntries(parsed.validRows.map((row) => [row.rowNumber, crypto.randomUUID()])),
        };
      }
    } catch (failure) {
      setFileError(`File tidak dapat dibaca: ${failure.message}`);
    }
  };

  const processRows = async () => {
    if (!preview?.validRows.length || processing) return;
    setProcessing(true); setResults([]);
    const nextResults = [];
    const identity = importIdentity.current || { batchId: crypto.randomUUID(), requestIds: {} };
    importIdentity.current = identity;
    for (const row of preview.validRows) {
      try {
        if (kind === 'OUTBOUND') {
          const response = await issueMaterial({
            itemId: row.item.item_id ?? row.item.id,
            quantity: String(row.quantity), issueMethod: row.location ? 'MANUAL' : 'FIFO',
            location: row.location || null, transactionDate: localDateInput(), notes: '',
            requestId: identity.requestIds[row.rowNumber] ||= crypto.randomUUID(), importBatchId: identity.batchId,
          });
          nextResults.push({ rowNumber: row.rowNumber, sku: row.sku, ok: true, stockAfter: response.stock_after });
        } else {
          await upsertFifoSettings({ itemId: row.item.item_id ?? row.item.id, minQty: String(row.min), maxQty: String(row.max), remarks: '' });
          nextResults.push({ rowNumber: row.rowNumber, sku: row.sku, ok: true });
        }
      } catch (failure) {
        nextResults.push({ rowNumber: row.rowNumber, sku: row.sku, ok: false, error: failure.message });
      }
      setResults([...nextResults]);
    }
    await refresh();
    setProcessing(false);
  };

  const changeKind = (event) => {
    setKind(event.target.value); setPreview(null); setResults([]); setFileError(''); importIdentity.current = null;
  };

  return <section className="space-y-4">
    <PageHeader title="Import" description="Periksa preview sebelum data diproses. SKU yang belum dikenal harus ditambahkan melalui Kelola SKU." />
    <Panel ariaLabel="Konfigurasi import" className="space-y-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FieldLabel label="Jenis import" className="flex-1"><select aria-label="Jenis import" value={kind} onChange={changeKind} className={inputClass}><option value="OUTBOUND">Barang keluar FIFO</option><option value="MINMAX">SKU MIN/MAX</option></select></FieldLabel>
        <button type="button" onClick={downloadTemplate} className={secondaryButtonClass}>Unduh template</button>
      </div>
      <FieldLabel label="Pilih file (.xlsx, .xls, .csv)"><input aria-label="File import" type="file" accept=".xlsx,.xls,.csv" onChange={readFile} className={`${inputClass} block file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700`} /></FieldLabel>
      {fileError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>}
    </Panel>
    {preview && <Panel ariaLabel="Preview import" className="space-y-3 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold text-slate-900">Preview import</h3><p className="text-xs text-slate-500">{preview.validRows.length} valid · {preview.invalidRows.length} tidak valid</p></div><button type="button" disabled={!preview.validRows.length || processing} onClick={processRows} className={primaryButtonClass}>{processing ? 'Memproses...' : `Proses ${preview.validRows.length} baris valid`}</button></div>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">{preview.rows.map((row) => <p key={`${row.rowNumber}-${row.sku}`} className={`p-3 text-xs ${row.valid ? 'bg-emerald-50/50 text-emerald-700' : 'bg-red-50/50 text-red-700'}`}>Baris {row.rowNumber} · {row.sku || 'tanpa SKU'} · {row.valid ? 'Valid' : row.reason}</p>)}</div>
    </Panel>}
    {results.length > 0 && <Panel ariaLabel="Hasil proses import" className="space-y-2 p-5"><h3 className="text-sm font-bold text-slate-900">Hasil proses</h3>{results.map((result) => <p key={result.rowNumber} className={`rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>Baris {result.rowNumber} {result.ok ? `berhasil${result.stockAfter != null ? ` · stok ${result.stockAfter}` : ''}` : `gagal · ${result.error}`}</p>)}</Panel>}
  </section>;
};

export default ImportPage;
