import React, { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { issueMaterial, upsertFifoSettings } from '../api/materialFifoApi';
import { parseMinMaxRows, parseOutboundRows } from '../lib/importRows';
import { localDateInput } from '../lib/dates';

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
            quantity: String(row.quantity),
            issueMethod: row.location ? 'MANUAL' : 'FIFO',
            location: row.location || null,
            transactionDate: localDateInput(), notes: '',
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
    <div><h2 className="text-2xl font-bold text-slate-900">Import</h2><p className="text-sm text-slate-500">Periksa preview sebelum data diproses. SKU yang belum dikenal harus ditambahkan melalui Kelola SKU.</p></div>
    <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium">Jenis import<select aria-label="Jenis import" value={kind} onChange={changeKind} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="OUTBOUND">Barang keluar FIFO</option><option value="MINMAX">SKU MIN/MAX</option></select></label>
        <button type="button" onClick={downloadTemplate} className="rounded-lg border border-blue-200 px-4 py-2 font-semibold text-blue-700">Unduh template</button>
      </div>
      <label className="block text-sm font-medium">Pilih file (.xlsx, .xls, .csv)<input aria-label="File import" type="file" accept=".xlsx,.xls,.csv" onChange={readFile} className="mt-1 block w-full rounded-lg border p-2" /></label>
      {fileError && <p role="alert" className="text-sm text-red-600">{fileError}</p>}
    </div>
    {preview && <div className="space-y-3 rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold">Preview import</h3><p className="text-sm text-slate-500">{preview.validRows.length} valid · {preview.invalidRows.length} tidak valid</p></div><button type="button" disabled={!preview.validRows.length || processing} onClick={processRows} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{processing ? 'Memproses...' : `Proses ${preview.validRows.length} baris valid`}</button></div>
      <div className="divide-y rounded-lg border">{preview.rows.map((row) => <p key={`${row.rowNumber}-${row.sku}`} className={`p-3 text-sm ${row.valid ? 'text-green-700' : 'text-red-600'}`}>Baris {row.rowNumber} · {row.sku || 'tanpa SKU'} · {row.valid ? 'Valid' : row.reason}</p>)}</div>
    </div>}
    {results.length > 0 && <div className="space-y-2 rounded-xl border bg-white p-5"><h3 className="font-bold">Hasil proses</h3>{results.map((result) => <p key={result.rowNumber} className={`text-sm ${result.ok ? 'text-green-700' : 'text-red-600'}`}>Baris {result.rowNumber} {result.ok ? `berhasil${result.stockAfter != null ? ` · stok ${result.stockAfter}` : ''}` : `gagal · ${result.error}`}</p>)}</div>}
  </section>;
};

export default ImportPage;
