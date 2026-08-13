import React from 'react';
import { useOutletContext } from 'react-router-dom';

const OverviewPage = (props) => {
  const outlet = useOutletContext() ?? {};
  const materials = props.materials ?? outlet.materials ?? [];
  const lotsByItem = props.lotsByItem ?? outlet.lotsByItem ?? {};
  const count = (status) => materials.filter((material) => material.fifo_status === status).length;
  const cards = [
    ['Total Material', materials.length, 'total'], ['Normal', count('NORMAL'), 'normal'],
    ['Kritis', count('CRITICAL'), 'critical'], ['Over', count('OVER'), 'over'],
    ['Tanpa Lot', materials.filter((material) => !(lotsByItem[material.item_id]?.length)).length, 'no-lot'],
    ['MIN/MAX Belum Diset', count('NOT_CONFIGURED'), 'not-configured'],
  ];
  const attention = materials.filter((material) => ['CRITICAL', 'OVER'].includes(material.fifo_status));
  return <section className="space-y-6">
    <div><h2 className="text-2xl font-bold text-slate-900">Overview</h2><p className="text-sm text-slate-500">Ringkasan stok Raw Material berdasarkan lot FIFO.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, key]) => <div key={key} data-testid={`kpi-${key}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold text-slate-900">{value}</p></div>)}</div>
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-semibold text-slate-900">Perlu Perhatian</h3><div className="mt-3 divide-y divide-slate-100">{attention.length ? attention.map((item) => <div key={item.item_id} className="flex justify-between py-3"><div><b>{item.sku}</b><p className="text-sm text-slate-500">{item.item_name}</p></div><span className="font-semibold">{Number(item.stock_qty).toLocaleString('id-ID')} {item.uom}</span></div>) : <p className="py-6 text-center text-sm text-slate-500">Tidak ada material kritis atau over.</p>}</div></div>
  </section>;
};
export default OverviewPage;
