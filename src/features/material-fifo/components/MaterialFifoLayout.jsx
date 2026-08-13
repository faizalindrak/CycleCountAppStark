import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Menu, Package, X } from 'lucide-react';

const links = [
  ['overview', 'Overview'], ['data', 'Data FIFO'], ['transactions', 'Transaksi'],
  ['import', 'Import'], ['export', 'Export'], ['sku', 'Kelola SKU'],
];

const MaterialFifoLayout = ({ context, openInbound, openOutbound, lastRefresh }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  const sidebar = (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-5">
        <div className="flex items-center gap-2 font-bold text-slate-900"><Package className="h-5 w-5 text-blue-600" /> Material FIFO</div>
        <button className="lg:hidden" aria-label="Tutup menu" onClick={() => setOpen(false)}><X /></button>
      </div>
      <nav className="space-y-1 p-3">
        {links.map(([to, label]) => <NavLink key={to} to={`/material-fifo/${to}`} onClick={() => setOpen(false)} className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</NavLink>)}
        <button onClick={() => navigate('/home')} className="mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Kembali ke Home</button>
      </nav>
    </>
  );

  return <div className="min-h-screen bg-slate-100">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
    {open && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-72 bg-white" onClick={(event) => event.stopPropagation()}>{sidebar}</aside></div>}
    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3"><button aria-label="Buka menu" onClick={() => setOpen(true)} className="lg:hidden"><Menu /></button><div><h1 className="font-bold text-slate-900">Material FIFO Raw Material</h1><p className="text-xs text-slate-500">{navigator.onLine ? 'Online' : 'Offline'}{lastRefresh ? ` · Diperbarui ${lastRefresh.toLocaleTimeString('id-ID')}` : ''}</p></div></div>
          <div className="flex gap-2"><button onClick={openInbound} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><ArrowDownToLine className="h-4 w-4" /> Barang Masuk</button><button onClick={openOutbound} className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white"><ArrowUpFromLine className="h-4 w-4" /> Barang Keluar</button></div>
        </div>
      </header>
      <main className="p-4 sm:p-6"><Outlet context={context} /></main>
    </div>
  </div>;
};

export default MaterialFifoLayout;
