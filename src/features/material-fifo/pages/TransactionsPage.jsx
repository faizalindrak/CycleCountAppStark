import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

const TransactionsPage = (props) => {
  const outlet = useOutletContext() ?? {};
  const transactions = props.transactions ?? outlet.transactions ?? [];
  const profiles = props.profiles ?? outlet.profiles ?? {};
  const [type, setType] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const user = profiles[transaction.created_by];
      const locations = (transaction.allocations ?? []).map((allocation) => allocation.lot?.location);
      const inboundLot = Array.isArray(transaction.inbound_lot) ? transaction.inbound_lot[0] : transaction.inbound_lot;
      const searchable = [transaction.item?.sku, transaction.item?.item_name, transaction.selected_location, inboundLot?.location, user?.name, user?.username, transaction.created_by, ...locations].filter(Boolean).join(' ').toLowerCase();
      return (type === 'ALL' || transaction.transaction_type === type)
        && (!dateFrom || transaction.transaction_date >= dateFrom)
        && (!dateTo || transaction.transaction_date <= dateTo)
        && (!query || searchable.includes(query));
    });
  }, [transactions, profiles, type, dateFrom, dateTo, search]);

  return <section className="space-y-4">
    <div><h2 className="text-2xl font-bold text-slate-900">Transaksi</h2><p className="text-sm text-slate-500">Riwayat audit bersifat permanen dan tidak dapat diedit atau dihapus.</p></div>
    <div className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
      <select aria-label="Tipe transaksi" value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border px-3 py-2"><option value="ALL">Semua tipe</option><option value="IN">Barang masuk</option><option value="OUT">Barang keluar</option></select>
      <input aria-label="Tanggal mulai" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border px-3 py-2" />
      <input aria-label="Tanggal akhir" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border px-3 py-2" />
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari SKU, lokasi, atau user..." className="rounded-lg border px-3 py-2" />
    </div>
    {!filtered.length && <div className="rounded-xl border bg-white p-8 text-center text-slate-500">Tidak ada transaksi yang sesuai.</div>}
    <div className="space-y-3">{filtered.map((transaction) => {
      const profile = profiles[transaction.created_by];
      const allocations = [...(transaction.allocations ?? [])].sort((a, b) => `${a.lot?.received_date ?? ''}|${a.lot?.id ?? ''}`.localeCompare(`${b.lot?.received_date ?? ''}|${b.lot?.id ?? ''}`));
      return <article key={transaction.id} className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`rounded-full px-2 py-1 text-xs font-bold ${transaction.transaction_type === 'IN' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{transaction.transaction_type === 'IN' ? 'MASUK' : 'KELUAR'}</span><p className="mt-2 font-bold">{transaction.item?.sku}</p><p className="text-sm text-slate-500">{transaction.item?.item_name}</p></div><div className="text-right"><p className="font-bold">{Number(transaction.quantity).toLocaleString('id-ID')} {transaction.item?.uom}</p><p className="text-sm text-slate-500">{transaction.transaction_date}</p><p className="text-xs text-slate-400">{profile?.name || profile?.username || transaction.created_by}</p></div></div>
        {transaction.transaction_type === 'OUT' && allocations.length > 0 && <><button type="button" aria-label={`Lihat alokasi ${transaction.item?.sku}`} onClick={() => setExpanded(expanded === transaction.id ? null : transaction.id)} className="mt-3 text-sm font-semibold text-blue-700">{expanded === transaction.id ? 'Tutup alokasi' : 'Lihat alokasi FIFO'}</button>{expanded === transaction.id && <div className="mt-2 divide-y rounded-lg bg-slate-50 px-3">{allocations.map((allocation) => <div data-testid="allocation-row" key={allocation.id} className="flex justify-between py-2 text-sm"><span>{allocation.lot?.location} · {allocation.lot?.received_date}</span><span>{Number(allocation.quantity).toLocaleString('id-ID')} {transaction.item?.uom}</span></div>)}</div>}</>}
      </article>;
    })}</div>
  </section>;
};

export default TransactionsPage;
