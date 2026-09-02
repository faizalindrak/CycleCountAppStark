import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Menu, X } from 'lucide-react';

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

  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  const refreshLabel = lastRefresh ? ` · Diperbarui ${lastRefresh.toLocaleTimeString('id-ID')}` : '';

  const sidebar = (mobile = false) => (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-blue-100/70 px-[18px]">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid h-8 w-8 grid-cols-2 gap-[3px] rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-[7px] shadow-md shadow-blue-200">
            <span className="rounded-[1px] bg-white" /><span className="rounded-[1px] bg-white/60" />
            <span className="rounded-[1px] bg-white/60" /><span className="rounded-[1px] bg-white" />
          </span>
          <span className="text-[13px] font-semibold text-slate-950">Material FIFO</span>
        </div>
        {mobile && (
          <button type="button" aria-label="Tutup menu" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav aria-label="Navigasi utama Material FIFO" className="flex-1 space-y-1 px-3 py-5">
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={`/material-fifo/${to}`}
            onClick={() => setOpen(false)}
            className={({ isActive }) => `block rounded-xl px-3 py-2.5 text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${isActive ? 'bg-gradient-to-r from-blue-50 to-cyan-50 font-semibold text-blue-700 shadow-sm' : 'text-slate-600 hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <button type="button" onClick={() => navigate('/home')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Home
        </button>
      </div>
    </div>
  );

  return (
    <div data-testid="material-fifo-shell" className="material-fifo-shell wms-page-shell text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[225px] border-r border-blue-100/80 bg-white/95 shadow-xl shadow-blue-100/30 backdrop-blur lg:block">{sidebar()}</aside>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setOpen(false)}>
          <aside id="material-fifo-mobile-nav" role="dialog" aria-modal="true" aria-label="Navigasi Material FIFO" className="h-full w-[min(82vw,288px)] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            {sidebar(true)}
          </aside>
        </div>
      )}
      <div className="min-w-0 lg:pl-[225px]">
        <header className="sticky top-0 z-20 border-b border-blue-100/80 bg-white/85 shadow-sm backdrop-blur">
          <div className="flex min-h-[65px] flex-col justify-center gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" aria-label="Buka menu" aria-expanded={open} aria-controls="material-fifo-mobile-nav" onClick={() => setOpen(true)} className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden">
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Warehouse insight</p>
                <h1 className="truncate text-sm font-semibold text-slate-950">Material FIFO Raw Material</h1>
                <p className="mt-0.5 flex items-center text-[11px] text-slate-400">
                  <span aria-hidden="true" className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  <span>{isOnline ? 'Online' : 'Offline'}{refreshLabel}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2 pl-11 sm:pl-0">
              <button type="button" onClick={openInbound} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:flex-none">
                <ArrowDownToLine className="h-3.5 w-3.5" /> Barang Masuk
              </button>
              <button type="button" onClick={openOutbound} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-orange-200 transition hover:-translate-y-0.5 hover:from-orange-600 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 sm:flex-none">
                <ArrowUpFromLine className="h-3.5 w-3.5" /> Barang Keluar
              </button>
            </div>
          </div>
        </header>
        <main className="relative min-w-0 p-4 sm:p-6 lg:p-7"><Outlet context={context} /></main>
      </div>
    </div>
  );
};

export default MaterialFifoLayout;
