import React, { useMemo, useState } from 'react';
import { ScanLine, Search } from 'lucide-react';
import CodeScanner from './CodeScanner';

const MaterialSearchField = ({ items = [], value, onChange, label = 'Material' }) => {
  const [query, setQuery] = useState(value?.sku ?? '');
  const [scanOpen, setScanOpen] = useState(false);
  const rawItems = useMemo(() => items.filter((item) => String(item.category).trim().toLowerCase() === 'raw material'), [items]);
  const options = useMemo(() => {
    const q = query.toLowerCase();
    return rawItems.filter((item) => [item.sku, item.item_name, item.item_code, item.internal_product_code].join(' ').toLowerCase().includes(q)).slice(0, 8);
  }, [query, rawItems]);
  const select = (item) => { setQuery(item.sku); onChange(item); };

  return <div className="relative">
    <label className="text-xs font-medium text-slate-700">{label}</label>
    <div className="mt-1 flex gap-2">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input aria-label={label} value={query} onChange={(event) => { setQuery(event.target.value); if (value) onChange(null); }} placeholder="Cari atau scan SKU..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20" /></div>
      <button type="button" aria-label={`Scan ${label}`} onClick={() => setScanOpen(true)} className="rounded-lg border border-slate-200 bg-white px-3 text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"><ScanLine className="h-4 w-4" /></button>
    </div>
    {query && !value && <div className="material-fifo-scrollbar absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">{options.length ? options.map((item) => <button type="button" key={item.item_id ?? item.id} onClick={() => select(item)} className="block w-full rounded-md px-3 py-2 text-left transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"><b className="font-mono text-xs text-slate-800">{item.sku}</b><span className="ml-2 text-xs text-slate-500">{item.item_name}</span></button>) : <p className="px-3 py-4 text-center text-xs text-slate-400">Material tidak ditemukan</p>}</div>}
    {scanOpen && <CodeScanner items={rawItems} onSelect={(item) => { select(item); setScanOpen(false); }} onClose={() => setScanOpen(false)} />}
  </div>;
};

export default MaterialSearchField;
