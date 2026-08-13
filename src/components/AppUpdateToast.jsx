import React, { useEffect, useRef, useState } from 'react';

const defaultReload = () => window.location.reload();

const AppUpdateToast = ({
  serviceWorker = typeof navigator !== 'undefined' ? navigator.serviceWorker : null,
  reload = defaultReload,
}) => {
  const [waiting, setWaiting] = useState(null);
  const [visible, setVisible] = useState(false);
  const reloadRequested = useRef(false);

  useEffect(() => {
    if (!serviceWorker?.register) return undefined;
    let active = true;
    const inspectRegistration = (registration) => {
      if (!active) return;
      if (registration.waiting && serviceWorker.controller) {
        setWaiting(registration.waiting);
        setVisible(true);
      }
      registration.addEventListener?.('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener?.('statechange', () => {
          if (worker.state === 'installed' && serviceWorker.controller) {
            setWaiting(registration.waiting || worker);
            setVisible(true);
          }
        });
      });
    };
    serviceWorker.register('/sw.js').then(inspectRegistration).catch(() => undefined);
    const controllerChanged = () => {
      if (!reloadRequested.current) return;
      reloadRequested.current = false;
      reload();
    };
    serviceWorker.addEventListener?.('controllerchange', controllerChanged);
    return () => {
      active = false;
      serviceWorker.removeEventListener?.('controllerchange', controllerChanged);
    };
  }, [reload, serviceWorker]);

  if (!visible || !waiting) return null;
  const update = () => {
    reloadRequested.current = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };
  return <aside role="status" className="fixed bottom-4 right-4 z-[100] w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-blue-200 bg-white p-4 shadow-2xl">
    <p className="font-bold text-slate-900">Versi aplikasi baru tersedia</p>
    <p className="mt-1 text-sm text-slate-500">Perbarui setelah pekerjaan transaksi selesai.</p>
    <div className="mt-3 flex gap-2"><button type="button" onClick={update} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Perbarui sekarang</button><button type="button" onClick={() => setVisible(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Nanti</button></div>
  </aside>;
};

export default AppUpdateToast;
