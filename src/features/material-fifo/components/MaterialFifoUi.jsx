import React from 'react';
import { X } from 'lucide-react';

export const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';
export const primaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-200 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const PageHeader = ({ title, description, children }) => (
  <div className="flex flex-col gap-4 rounded-3xl border border-blue-100/80 bg-white/85 p-5 shadow-lg shadow-blue-100/30 backdrop-blur lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">Material FIFO workspace</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{description}</p>
    </div>
    {children && <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>}
  </div>
);

export const Panel = ({ children, className = '', ariaLabel }) => (
  <section aria-label={ariaLabel} className={`wms-card-lift rounded-2xl border border-blue-100/80 bg-white/95 shadow-lg shadow-blue-100/30 ${className}`}>
    {children}
  </section>
);

export const TableShell = ({ children, minWidth, label }) => (
  <div data-testid="table-scroll" className="material-fifo-scrollbar overflow-x-auto rounded-2xl border border-blue-100/80 bg-white/95 shadow-xl shadow-blue-100/30">
    <table aria-label={label} className="w-full border-collapse text-xs" style={minWidth ? { minWidth } : undefined}>
      {children}
    </table>
  </div>
);

export const EmptyState = ({ children, colSpan }) => colSpan ? (
  <tr><td colSpan={colSpan} className="px-4 py-16 text-center text-sm text-slate-400">{children}</td></tr>
) : (
  <div className="px-4 py-12 text-center text-sm text-slate-400">{children}</div>
);

const statusPresentation = {
  NORMAL: { label: 'Normal', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
  CRITICAL: { label: 'Kritis', badge: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  OVER: { label: 'Over', badge: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  NOT_CONFIGURED: { label: 'Belum diset', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' },
  IN: { label: 'Masuk', badge: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  OUT: { label: 'Keluar', badge: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
};

export const getStatusPresentation = (status) => statusPresentation[status] ?? {
  label: status || 'Tidak diketahui',
  badge: 'bg-slate-100 text-slate-600',
  dot: 'bg-slate-300',
};

export const StatusBadge = ({ status, showDot = false }) => {
  const presentation = getStatusPresentation(status);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${presentation.badge}`}>
      {showDot && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${presentation.dot}`} />}
      {presentation.label}
    </span>
  );
};

export const LotChip = ({ lot, uom }) => (
  <span
    data-testid="lot-chip"
    aria-label={`${lot.location} · ${Number(lot.remaining_qty).toLocaleString('id-ID')} ${uom} · ${lot.received_date}`}
    className="group relative inline-flex whitespace-nowrap rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 font-mono text-[10px] leading-4 text-indigo-700"
  >
    <span>{lot.location} · {Number(lot.remaining_qty).toLocaleString('id-ID')} {uom}</span>
    <span
      data-testid="lot-date"
      className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
    >
      {lot.received_date}
    </span>
  </span>
);

export const FieldLabel = ({ label, children, className = '' }) => (
  <label className={`block text-xs font-medium text-slate-700 ${className}`}>{label}{children}</label>
);

export const ModalFrame = ({ title, description, onClose, children, footer, onSubmit, size = 'max-w-xl' }) => {
  const Container = onSubmit ? 'form' : 'section';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[1px] sm:p-4">
      <Container
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={onSubmit}
        className={`flex max-h-[calc(100dvh-1.5rem)] w-full ${size} flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-blue-950/20 sm:max-h-[calc(100dvh-2rem)]`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950 sm:text-lg">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{description}</p>}
          </div>
          <button type="button" aria-label={`Tutup ${title}`} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="material-fifo-scrollbar min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-5 py-4">{footer}</footer>}
      </Container>
    </div>
  );
};

