import React from 'react';
import { AlertTriangle, Boxes, CircleCheck, CircleHelp, Layers3, TrendingUp } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { EmptyState, PageHeader, Panel, StatusBadge, TableShell } from '../components/MaterialFifoUi';

const OverviewPage = (props) => {
  const outlet = useOutletContext() ?? {};
  const materials = props.materials ?? outlet.materials ?? [];
  const lotsByItem = props.lotsByItem ?? outlet.lotsByItem ?? {};
  const count = (status) => materials.filter((material) => material.fifo_status === status).length;
  const cards = [
    { label: 'Total Material', value: materials.length, key: 'total', icon: Boxes, accent: 'text-blue-600', iconBg: 'bg-blue-50' },
    { label: 'Normal', value: count('NORMAL'), key: 'normal', icon: CircleCheck, accent: 'text-emerald-600', iconBg: 'bg-emerald-50' },
    { label: 'Kritis', value: count('CRITICAL'), key: 'critical', icon: AlertTriangle, accent: 'text-red-600', iconBg: 'bg-red-50' },
    { label: 'Over', value: count('OVER'), key: 'over', icon: TrendingUp, accent: 'text-violet-600', iconBg: 'bg-violet-50' },
    { label: 'Tanpa Lot', value: materials.filter((material) => !(lotsByItem[material.item_id]?.length)).length, key: 'no-lot', icon: Layers3, accent: 'text-orange-600', iconBg: 'bg-orange-50' },
    { label: 'MIN/MAX Belum Diset', value: count('NOT_CONFIGURED'), key: 'not-configured', icon: CircleHelp, accent: 'text-slate-500', iconBg: 'bg-slate-100' },
  ];
  const attention = materials.filter((material) => ['CRITICAL', 'OVER'].includes(material.fifo_status));

  return (
    <section className="space-y-5">
      <PageHeader title="Overview" description="Ringkasan stok Raw Material berdasarkan lot FIFO." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, key, icon: Icon, accent, iconBg }) => (
          <Panel key={key} className="flex items-center justify-between p-4" ariaLabel={label}>
            <div>
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p data-testid={`kpi-${key}`} className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
            </div>
            <span className={`rounded-xl p-2.5 ${iconBg} ${accent}`}><Icon className="h-5 w-5" /></span>
          </Panel>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Perlu Perhatian</h3>
          <p className="text-xs text-slate-500">Material dengan stok kritis atau melebihi batas maksimum.</p>
        </div>
        <TableShell label="Material perlu perhatian" minWidth="640px">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {['SKU', 'Nama Material', 'Stock', 'Status'].map((heading) => (
                <th key={heading} scope="col" className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${heading === 'Stock' ? 'text-right' : 'text-left'}`}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!attention.length ? <EmptyState colSpan={4}>Tidak ada material kritis atau over.</EmptyState> : attention.map((item, index) => (
              <tr key={item.item_id} className={`border-b border-slate-100 ${index % 2 ? 'bg-slate-50/45' : 'bg-white'}`}>
                <td className="px-4 py-3.5 font-mono text-[11px] font-medium text-slate-800">{item.sku}</td>
                <td className="px-4 py-3.5 font-medium text-slate-800">{item.item_name}</td>
                <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">{Number(item.stock_qty).toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">{item.uom}</span></td>
                <td className="px-4 py-3.5"><StatusBadge status={item.fifo_status} showDot /></td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </div>
    </section>
  );
};

export default OverviewPage;

