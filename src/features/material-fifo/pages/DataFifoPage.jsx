import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { upsertFifoSettings } from '../api/materialFifoApi';

const validSetting = (value) => /^\d+(\.\d{1,4})?$/.test(value);

const SettingsModal = ({ item, onClose, refresh }) => {
  const [minQty, setMinQty] = useState(item.min_qty ?? '');
  const [maxQty, setMaxQty] = useState(item.max_qty ?? '');
  const [remarks, setRemarks] = useState(item.remarks ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validSetting(minQty) || !validSetting(maxQty)) {
      setError('MIN dan MAX wajib berupa angka non-negatif, maksimal 4 desimal.');
      return;
    }
    if (Number(minQty) > Number(maxQty)) {
      setError('MIN tidak boleh lebih besar dari MAX.');
      return;
    }
    setSaving(true);
    try {
      await upsertFifoSettings({ itemId: item.item_id, minQty, maxQty, remarks });
      await refresh();
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
    <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <div><h3 className="text-xl font-bold">Atur MIN/MAX</h3><p className="text-sm text-slate-500">{item.sku} · {item.item_name}</p></div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">MIN<input aria-label="MIN" inputMode="decimal" value={minQty} onChange={(event) => setMinQty(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm font-medium">MAX<input aria-label="MAX" inputMode="decimal" value={maxQty} onChange={(event) => setMaxQty(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
      </div>
      <label className="block text-sm font-medium">Catatan<input aria-label="Catatan MIN/MAX" value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-lg border px-4 py-2">Batal</button><button disabled={saving} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan pengaturan'}</button></div>
    </form>
  </div>;
};

const DataFifoPage = (props) => {
  const outlet = useOutletContext() ?? {};
  const materials = props.materials ?? outlet.materials ?? [];
  const lotsByItem = props.lotsByItem ?? outlet.lotsByItem ?? {};
  const refresh = props.refresh ?? outlet.refresh ?? (() => Promise.resolve());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [editing, setEditing] = useState(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return materials.filter((item) => {
      const searchable = [item.sku, item.item_name, item.item_code, item.internal_product_code].join(' ').toLowerCase();
      return (!query || searchable.includes(query)) && (status === 'ALL' || item.fifo_status === status);
    });
  }, [materials, search, status]);

  return <section className="space-y-4">
    <div><h2 className="text-2xl font-bold text-slate-900">Data FIFO</h2><p className="text-sm text-slate-500">Stok dihitung dari total lot yang tersisa.</p></div>
    <div className="flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari SKU, nama, atau kode..." className="flex-1 rounded-lg border border-slate-300 px-3 py-2"/><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2"><option value="ALL">Semua status</option><option value="NORMAL">Normal</option><option value="CRITICAL">Kritis</option><option value="OVER">Over</option><option value="NOT_CONFIGURED">Belum diset</option></select></div>
    <div className="space-y-3">{filtered.map((item) => {
      const lots = [...(lotsByItem[item.item_id] ?? [])].sort((a, b) => `${a.received_date}|${a.created_at ?? ''}|${a.id}`.localeCompare(`${b.received_date}|${b.created_at ?? ''}|${b.id}`));
      return <article key={item.item_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold text-slate-900">{item.sku}</p><p className="text-sm text-slate-600">{item.item_name}</p><p className="text-xs text-slate-400">{item.internal_product_code}</p></div><div className="text-right"><p className="text-xl font-bold text-slate-900">{Number(item.stock_qty).toLocaleString('id-ID')} {item.uom}</p><p className="text-xs text-slate-500">MIN {item.min_qty ?? '—'} · MAX {item.max_qty ?? '—'}</p><button type="button" aria-label={`Atur MIN/MAX ${item.sku}`} onClick={() => setEditing(item)} className="mt-2 rounded-lg border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700">Atur MIN/MAX</button></div></div><div className="mt-3 flex flex-wrap gap-2">{lots.length ? lots.map((lot) => <span data-testid="lot-chip" key={lot.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">{lot.location} · {Number(lot.remaining_qty).toLocaleString('id-ID')} · {lot.received_date}</span>) : <span className="text-xs text-slate-400">Belum ada lot</span>}</div></article>;
    })}</div>
    {editing && <SettingsModal item={editing} refresh={refresh} onClose={() => setEditing(null)} />}
  </section>;
};

export default DataFifoPage;
