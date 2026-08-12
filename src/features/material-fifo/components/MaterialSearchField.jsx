import React, { useMemo, useState } from 'react';
import { ScanLine } from 'lucide-react';
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
  return <div className="relative"><label className="text-sm font-medium text-slate-700">{label}</label><div className="mt-1 flex gap-2"><input aria-label={label} value={query} onChange={(event) => { setQuery(event.target.value); if (value) onChange(null); }} placeholder="Cari atau scan SKU..." className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"/><button type="button" aria-label={`Scan ${label}`} onClick={() => setScanOpen(true)} className="rounded-lg border border-slate-300 px-3 text-blue-600"><ScanLine /></button></div>{query && !value && <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-white shadow-lg">{options.map((item) => <button type="button" key={item.item_id ?? item.id} onClick={() => select(item)} className="block w-full px-3 py-2 text-left hover:bg-blue-50"><b>{item.sku}</b><span className="ml-2 text-sm text-slate-500">{item.item_name}</span></button>)}</div>}{scanOpen && <CodeScanner items={rawItems} onSelect={(item) => { select(item); setScanOpen(false); }} onClose={() => setScanOpen(false)} />}</div>;
};
export default MaterialSearchField;
