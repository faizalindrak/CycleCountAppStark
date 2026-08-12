import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { toStockExportRows, toTransactionExportRows } from '../lib/exportRows';
import { localDateInput } from '../lib/dates';

const saveRows = (rows, sheetName, filename) => {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filename);
};

const ExportPage = (props) => {
  const outlet = useOutletContext() ?? {};
  const materials = props.materials ?? outlet.materials ?? [];
  const lotsByItem = props.lotsByItem ?? outlet.lotsByItem ?? {};
  const transactions = props.transactions ?? outlet.transactions ?? [];
  const profiles = props.profiles ?? outlet.profiles ?? {};
  const [query, setQuery] = useState('');
  const filteredMaterials = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return materials.filter((item) => !normalized || `${item.sku} ${item.item_name}`.toLowerCase().includes(normalized));
  }, [materials, query]);
  const withLots = (rows) => rows.map((item) => ({ ...item, lots: lotsByItem[item.item_id ?? item.id] ?? [] }));
  const exportStock = (rows) => saveRows(toStockExportRows(withLots(rows)), 'Stok FIFO', `stok_material_fifo_${localDateInput()}.xlsx`);
  const exportTransactions = () => {
    const rows = transactions.map((transaction) => ({ ...transaction, created_by_name: profiles[transaction.created_by]?.name ?? profiles[transaction.created_by]?.username ?? transaction.created_by }));
    saveRows(toTransactionExportRows(rows), 'Transaksi FIFO', `transaksi_material_fifo_${localDateInput()}.xlsx`);
  };

  return <section className="space-y-4">
    <div><h2 className="text-2xl font-bold text-slate-900">Export</h2><p className="text-sm text-slate-500">Unduh stok beserta detail lot atau histori transaksi lengkap.</p></div>
    <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm"><h3 className="font-bold">Stok Material FIFO</h3><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter SKU atau nama..." className="w-full rounded-lg border px-3 py-2" /><p className="text-sm text-slate-500">{filteredMaterials.length} dari {materials.length} material</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => exportStock(materials)} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Export semua stok</button><button type="button" onClick={() => exportStock(filteredMaterials)} className="rounded-lg border border-blue-200 px-4 py-2 font-semibold text-blue-700">Export stok terfilter</button></div></div>
    <div className="rounded-xl border bg-white p-5 shadow-sm"><h3 className="font-bold">Histori Transaksi</h3><p className="mb-4 text-sm text-slate-500">{transactions.length} transaksi termasuk detail user dan alokasi lot.</p><button type="button" onClick={exportTransactions} className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">Export semua transaksi</button></div>
  </section>;
};

export default ExportPage;
