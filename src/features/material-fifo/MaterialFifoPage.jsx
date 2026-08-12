import React, { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import MaterialFifoLayout from './components/MaterialFifoLayout';
import OverviewPage from './pages/OverviewPage';
import DataFifoPage from './pages/DataFifoPage';
import { useMaterialFifoData } from './hooks/useMaterialFifoData';

const Placeholder = ({ title }) => <div className="rounded-xl border bg-white p-8"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-slate-500">Fitur sedang dimuat dalam integrasi Material FIFO.</p></div>;

const MaterialFifoPage = () => {
  const data = useMaterialFifoData();
  const [modal, setModal] = useState(null);
  if (data.loading && !data.materials.length) return <LoadingSpinner />;
  const context = { ...data, openInbound: () => setModal('in'), openOutbound: () => setModal('out') };
  return <>
    <Routes><Route element={<MaterialFifoLayout context={context} openInbound={context.openInbound} openOutbound={context.openOutbound} lastRefresh={data.lastRefresh} />}><Route index element={<Navigate to="overview" replace />} /><Route path="overview" element={<OverviewPage />} /><Route path="data" element={<DataFifoPage />} /><Route path="transactions" element={<Placeholder title="Transaksi" />} /><Route path="import" element={<Placeholder title="Import" />} /><Route path="export" element={<Placeholder title="Export" />} /><Route path="sku" element={<Placeholder title="Kelola SKU" />} /></Route></Routes>
    {modal && <div role="dialog" aria-label={modal === 'in' ? 'Barang Masuk' : 'Barang Keluar'} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"><div className="rounded-xl bg-white p-6"><p>{modal === 'in' ? 'Barang Masuk' : 'Barang Keluar'}</p><button onClick={() => setModal(null)}>Tutup</button></div></div>}
  </>;
};
export default MaterialFifoPage;
