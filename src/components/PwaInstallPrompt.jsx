import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const PwaInstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const capture = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setDismissed(false);
    };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  if (!installEvent || dismissed) return null;
  return (
    <aside role="status" className="fixed bottom-5 right-5 z-[90] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-blue-100 bg-white/95 p-4 shadow-2xl shadow-blue-200/40 backdrop-blur dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-950/40">
      <button type="button" aria-label="Tutup banner instalasi" onClick={() => setDismissed(true)} className="absolute right-2 top-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="h-4 w-4" /></button>
      <div className="flex items-start gap-3 pr-5">
        <span className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/15 dark:text-cyan-300"><Download className="h-5 w-5" /></span>
        <div><p className="font-bold text-slate-900 dark:text-white">Pasang Warehouse Operations</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Akses lebih cepat dan tetap siap saat koneksi tidak stabil.</p></div>
      </div>
      <button type="button" onClick={install} className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-200 transition hover:-translate-y-0.5 dark:shadow-slate-950/30">Pasang aplikasi</button>
    </aside>
  );
};

export default PwaInstallPrompt;
