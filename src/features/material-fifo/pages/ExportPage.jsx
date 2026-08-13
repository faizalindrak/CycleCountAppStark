import React, { useMemo, useState } from 'react';
import { Download, FileClock, Search } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { inputClass, PageHeader, Panel, primaryButtonClass, secondaryButtonClass } from '../components/MaterialFifoUi';
import { localDateInput } from '../lib/dates';
import { toStockExportRows, toTransactionExportRows } from '../lib/exportRows';

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
    <PageHeader title="Export" description="Unduh stok beserta detail lot atau histori transaksi lengkap." />
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel ariaLabel="Stok Material FIFO" className="space-y-4 p-5">
        <div className="flex items-start gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Download className="h-5 w-5" /></span><div><h3 className="text-sm font-bold text-slate-900">Stok Material FIFO</h3><p className="text-xs text-slate-500">Termasuk detail lokasi, qty, dan tanggal setiap lot.</p></div></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter SKU atau nama..." className={`${inputClass} mt-0 pl-9`} /></div>
        <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">{filteredMaterials.length}</span> dari {materials.length} material</p>
        <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => exportStock(materials)} className={primaryButtonClass}>Export semua stok</button><button type="button" onClick={() => exportStock(filteredMaterials)} className={secondaryButtonClass}>Export stok terfilter</button></div>
      </Panel>
      <Panel ariaLabel="Histori Transaksi" className="flex flex-col p-5">
        <div className="flex items-start gap-3"><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><FileClock className="h-5 w-5" /></span><div><h3 className="text-sm font-bold text-slate-900">Histori Transaksi</h3><p className="text-xs text-slate-500">Audit permanen termasuk user dan alokasi lot.</p></div></div>
        <p className="mb-5 mt-4 text-xs text-slate-500"><span className="font-semibold text-slate-700">{transactions.length}</span> transaksi tersedia.</p>
        <button type="button" onClick={exportTransactions} className={`${secondaryButtonClass} mt-auto self-start`}>Export semua transaksi</button>
      </Panel>
    </div>
  </section>;
};

export default ExportPage;
