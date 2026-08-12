import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

const DataFifoPage = (props) => {
  const outlet = useOutletContext() ?? {};
  const materials = props.materials ?? outlet.materials ?? [];
  const lotsByItem = props.lotsByItem ?? outlet.lotsByItem ?? {};
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return materials.filter((item) => {
      const searchable = [item.sku, item.item_name, item.item_code, item.internal_product_code].join(' ').toLowerCase();
      return (!query || searchable.includes(query)) && (status === 'ALL' || item.fifo_status === status);
    });
  }, [materials, search, status]);
  return <section className="space-y-4"><div><h2 className="text-2xl font-bold text-slate-900">Data FIFO</h2><p className="text-sm text-slate-500">Stok dihitung dari total lot yang tersisa.</p></div>
    <div className="flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari SKU, nama, atau kode..." className="flex-1 rounded-lg border border-slate-300 px-3 py-2"/><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2"><option value="ALL">Semua status</option><option value="NORMAL">Normal</option><option value="CRITICAL">Kritis</option><option value="OVER">Over</option><option value="NOT_CONFIGURED">Belum diset</option></select></div>
    <div className="space-y-3">{filtered.map((item) => { const lots = [...(lotsByItem[item.item_id] ?? [])].sort((a,b) => `${a.received_date}|${a.created_at ?? ''}|${a.id}`.localeCompare(`${b.received_date}|${b.created_at ?? ''}|${b.id}`)); return <article key={item.item_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold text-slate-900">{item.sku}</p><p className="text-sm text-slate-600">{item.item_name}</p><p className="text-xs text-slate-400">{item.internal_product_code}</p></div><div className="text-right"><p className="text-xl font-bold text-slate-900">{Number(item.stock_qty).toLocaleString('id-ID')} {item.uom}</p><p className="text-xs text-slate-500">MIN {item.min_qty ?? '—'} · MAX {item.max_qty ?? '—'}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{lots.length ? lots.map((lot) => <span data-testid="lot-chip" key={lot.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">{lot.location} · {Number(lot.remaining_qty).toLocaleString('id-ID')} · {lot.received_date}</span>) : <span className="text-xs text-slate-400">Belum ada lot</span>}</div></article>; })}</div>
  </section>;
};
export default DataFifoPage;
