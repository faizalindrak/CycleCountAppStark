import React, { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import MaterialFifoLayout from './components/MaterialFifoLayout';
import OverviewPage from './pages/OverviewPage';
import DataFifoPage from './pages/DataFifoPage';
import TransactionsPage from './pages/TransactionsPage';
import ManageSkuPage from './pages/ManageSkuPage';
import ImportPage from './pages/ImportPage';
import ExportPage from './pages/ExportPage';
import FifoInboundModal from './components/FifoInboundModal';
import FifoOutboundModal from './components/FifoOutboundModal';
import { useMaterialFifoData } from './hooks/useMaterialFifoData';

const MaterialFifoPage = () => {
  const data = useMaterialFifoData();
  const [modal, setModal] = useState(null);
  if (data.loading && !data.materials.length) return <LoadingSpinner />;
  const context = { ...data, openInbound: () => setModal('in'), openOutbound: () => setModal('out') };
  return <>
    <Routes><Route element={<MaterialFifoLayout context={context} openInbound={context.openInbound} openOutbound={context.openOutbound} lastRefresh={data.lastRefresh} />}><Route index element={<Navigate to="overview" replace />} /><Route path="overview" element={<OverviewPage />} /><Route path="data" element={<DataFifoPage />} /><Route path="transactions" element={<TransactionsPage />} /><Route path="import" element={<ImportPage />} /><Route path="export" element={<ExportPage />} /><Route path="sku" element={<ManageSkuPage />} /></Route></Routes>
    {modal === 'in' && <FifoInboundModal materials={data.materials} lotsByItem={data.lotsByItem} refresh={data.refresh} onClose={() => setModal(null)} />}
    {modal === 'out' && <FifoOutboundModal materials={data.materials} lotsByItem={data.lotsByItem} refresh={data.refresh} onClose={() => setModal(null)} />}
  </>;
};
export default MaterialFifoPage;
