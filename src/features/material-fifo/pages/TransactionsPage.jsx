import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { EmptyState, PageHeader, Panel, StatusBadge, TableShell } from '../components/MaterialFifoUi';

const controlClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

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

  return (
    <section className="space-y-4">
      <PageHeader title="Transaksi" description="Riwayat audit bersifat permanen dan tidak dapat diedit atau dihapus." />

      <Panel className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-[160px_160px_160px_minmax(220px,1fr)]" ariaLabel="Filter transaksi">
        <select aria-label="Tipe transaksi" value={type} onChange={(event) => setType(event.target.value)} className={controlClass}>
          <option value="ALL">Semua tipe</option><option value="IN">Barang masuk</option><option value="OUT">Barang keluar</option>
        </select>
        <input aria-label="Tanggal mulai" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={controlClass} />
        <input aria-label="Tanggal akhir" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={controlClass} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari SKU, lokasi, atau user..." className={`${controlClass} pl-9`} />
        </div>
      </Panel>

      <TableShell label="Riwayat transaksi FIFO" minWidth="760px">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {['Tipe', 'Tanggal', 'Material', 'Qty', 'User', 'Alokasi'].map((heading) => (
              <th key={heading} scope="col" className={`whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${heading === 'Qty' ? 'text-right' : 'text-left'}`}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!filtered.length ? <EmptyState colSpan={6}>Tidak ada transaksi yang sesuai.</EmptyState> : filtered.map((transaction, index) => {
            const profile = profiles[transaction.created_by];
            const allocations = [...(transaction.allocations ?? [])].sort((a, b) => `${a.lot?.received_date ?? ''}|${a.lot?.id ?? ''}`.localeCompare(`${b.lot?.received_date ?? ''}|${b.lot?.id ?? ''}`));
            const isExpanded = expanded === transaction.id;
            return (
              <React.Fragment key={transaction.id}>
                <tr className={`border-b border-slate-100 ${index % 2 ? 'bg-slate-50/45' : 'bg-white'}`}>
                  <td className="px-4 py-3.5"><StatusBadge status={transaction.transaction_type} showDot /></td>
                  <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-600">{transaction.transaction_date}</td>
                  <td className="px-4 py-3.5"><p className="font-mono text-[11px] font-semibold text-slate-800">{transaction.item?.sku}</p><p className="mt-0.5 text-[11px] text-slate-500">{transaction.item?.item_name}</p></td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">{Number(transaction.quantity).toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">{transaction.item?.uom}</span></td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{profile?.name || profile?.username || transaction.created_by}</td>
                  <td className="px-4 py-3.5">
                    {transaction.transaction_type === 'OUT' && allocations.length > 0 ? (
                      <button type="button" aria-label={`Lihat alokasi ${transaction.item?.sku}`} onClick={() => setExpanded(isExpanded ? null : transaction.id)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}{isExpanded ? 'Tutup' : 'Lihat FIFO'}
                      </button>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-slate-100 bg-blue-50/30">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="ml-auto max-w-xl divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-3">
                        {allocations.map((allocation) => (
                          <div data-testid="allocation-row" key={allocation.id} className="flex items-center justify-between gap-4 py-2 text-xs">
                            <span className="text-slate-600">{allocation.lot?.location} · {allocation.lot?.received_date}</span>
                            <span className="font-semibold tabular-nums text-slate-900">{Number(allocation.quantity).toLocaleString('id-ID')} {transaction.item?.uom}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </TableShell>
    </section>
  );
};

export default TransactionsPage;
