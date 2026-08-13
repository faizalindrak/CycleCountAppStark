import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { upsertFifoSettings } from '../api/materialFifoApi';
import {
  EmptyState,
  FieldLabel,
  getStatusPresentation,
  inputClass,
  LotChip,
  ModalFrame,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
  TableShell,
} from '../components/MaterialFifoUi';

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

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className={secondaryButtonClass}>Batal</button>
      <button type="submit" disabled={saving} className={primaryButtonClass}>
        {saving ? 'Menyimpan...' : 'Simpan pengaturan'}
      </button>
    </div>
  );

  return (
    <ModalFrame
      title="Atur MIN/MAX"
      description={`${item.sku} · ${item.item_name}`}
      onClose={onClose}
      onSubmit={submit}
      footer={footer}
      size="max-w-md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldLabel label="MIN">
            <input aria-label="MIN" inputMode="decimal" value={minQty} onChange={(event) => setMinQty(event.target.value)} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="MAX">
            <input aria-label="MAX" inputMode="decimal" value={maxQty} onChange={(event) => setMaxQty(event.target.value)} className={inputClass} />
          </FieldLabel>
        </div>
        <FieldLabel label="Catatan">
          <input aria-label="Catatan MIN/MAX" value={remarks} onChange={(event) => setRemarks(event.target.value)} className={inputClass} />
        </FieldLabel>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </ModalFrame>
  );
};

const sortLots = (lots) => [...lots].sort((a, b) =>
  `${a.received_date}|${a.created_at ?? ''}|${a.id}`.localeCompare(`${b.received_date}|${b.created_at ?? ''}|${b.id}`),
);

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
      const searchable = [item.sku, item.item_name, item.item_code, item.internal_product_code].filter(Boolean).join(' ').toLowerCase();
      return (!query || searchable.includes(query)) && (status === 'ALL' || item.fifo_status === status);
    });
  }, [materials, search, status]);

  const rows = useMemo(() => filtered.map((item) => ({
    item,
    lots: sortLots(lotsByItem[item.item_id] ?? []),
  })), [filtered, lotsByItem]);
  const fifoColumnCount = Math.max(2, ...rows.map(({ lots }) => lots.length));
  const columnCount = 7 + fifoColumnCount;

  return (
    <section className="space-y-4">
      <PageHeader title="Data FIFO" description="Stok dihitung dari total lot yang tersisa.">
        <div className="relative min-w-0 sm:w-64">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari SKU, nama, atau kode..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="ALL">Semua status</option>
          <option value="NORMAL">Normal</option>
          <option value="CRITICAL">Kritis</option>
          <option value="OVER">Over</option>
          <option value="NOT_CONFIGURED">Belum diset</option>
        </select>
      </PageHeader>

      <TableShell label="Data FIFO material" minWidth={`${850 + fifoColumnCount * 145}px`}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {['SKU', 'Product Code', 'Nama Item', 'Min', 'Max', 'Stock', 'Aksi'].map((heading) => (
              <th key={heading} scope="col" className={`whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${['Min', 'Max', 'Stock'].includes(heading) ? 'text-right' : 'text-left'}`}>
                {heading}
              </th>
            ))}
            {Array.from({ length: fifoColumnCount }, (_, index) => (
              <th key={index} scope="col" className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">FIFO {index + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!rows.length ? (
            <EmptyState colSpan={columnCount}>Tidak ada item ditemukan</EmptyState>
          ) : rows.map(({ item, lots }, index) => {
            const presentation = getStatusPresentation(item.fifo_status);
            return (
              <tr key={item.item_id} className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 ${index % 2 ? 'bg-slate-50/45' : 'bg-white'}`}>
                <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] font-medium text-slate-800">{item.sku}</td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-700">{item.item_code || item.internal_product_code || '—'}</span>
                </td>
                <td className="min-w-56 px-4 py-3.5 font-medium text-slate-800">{item.item_name}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{item.min_qty ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{item.max_qty ?? <span className="text-slate-300">—</span>}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <span className={`font-semibold tabular-nums ${item.fifo_status === 'CRITICAL' ? 'text-red-600' : item.fifo_status === 'NOT_CONFIGURED' ? 'text-slate-500' : 'text-slate-900'}`}>
                    {Number(item.stock_qty).toLocaleString('id-ID')}
                  </span>
                  <span className="ml-1 text-[10px] text-slate-400">{item.uom}</span>
                  <span title={presentation.label} aria-label={presentation.label} className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${presentation.dot}`} />
                </td>
                <td className="px-4 py-3.5">
                  <button
                    type="button"
                    aria-label={`Atur MIN/MAX ${item.sku}`}
                    onClick={() => setEditing(item)}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-blue-100 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <SlidersHorizontal className="h-3 w-3" /> Atur
                  </button>
                </td>
                {Array.from({ length: fifoColumnCount }, (_, lotIndex) => (
                  <td key={lotIndex} className="px-4 py-3.5">
                    {lots[lotIndex] ? <LotChip lot={lots[lotIndex]} uom={item.uom} /> : <span className="text-slate-200">—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      <p className="pb-1 text-[11px] text-slate-400">
        Menampilkan <span className="font-medium text-slate-600">{filtered.length}</span> dari <span className="font-medium text-slate-600">{materials.length}</span> item
      </p>

      {editing && <SettingsModal item={editing} refresh={refresh} onClose={() => setEditing(null)} />}
    </section>
  );
};

export default DataFifoPage;
