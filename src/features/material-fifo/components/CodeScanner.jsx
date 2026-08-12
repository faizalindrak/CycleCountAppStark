import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Camera, Keyboard, X } from 'lucide-react';
import { findItemByScannedCode, KeyboardWedgeBuffer } from '../lib/scanCodes';

const CodeScanner = ({ items, onSelect, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const frameRef = useRef(null);
  const wedgeRef = useRef(new KeyboardWedgeBuffer({ maxGapMs: 80, minLength: 3 }));
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('Memulai kamera...');

  const cleanupScanner = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    readerRef.current?.reset?.();
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resolveCode = useCallback((code) => {
    const item = findItemByScannedCode(code, items);
    if (!item) {
      setStatus(`Kode tidak ditemukan: ${code}`);
      return false;
    }
    cleanupScanner();
    onSelect(item);
    return true;
  }, [cleanupScanner, items, onSelect]);

  useEffect(() => {
    let disposed = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (disposed) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play?.().catch(() => undefined);
        }

        let fallbackStarted = false;
        const startZxing = () => {
          if (disposed || fallbackStarted) return;
          fallbackStarted = true;
          const reader = new BrowserMultiFormatReader();
          readerRef.current = reader;
          setStatus('Arahkan kamera ke QR atau barcode.');
          reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
            const text = result?.getText?.() ?? result?.text;
            if (text) resolveCode(text);
          });
        };

        if ('BarcodeDetector' in globalThis) {
          let detector;
          try {
            detector = new globalThis.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] });
          } catch {
            setStatus('Scanner native tidak tersedia, memakai fallback kamera.');
            startZxing();
            return;
          }
          const detect = async () => {
            if (disposed || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes[0]?.rawValue && resolveCode(codes[0].rawValue)) return;
            } catch {
              setStatus('Scanner native tidak tersedia, memakai fallback kamera.');
              startZxing();
              return;
            }
            frameRef.current = requestAnimationFrame(detect);
          };
          setStatus('Arahkan kamera ke QR atau barcode.');
          frameRef.current = requestAnimationFrame(detect);
          return;
        }

        startZxing();
      } catch (error) {
        cleanupScanner();
        setStatus(error?.name === 'NotAllowedError' ? 'Izin kamera ditolak. Gunakan scanner handheld atau input manual.' : 'Kamera tidak tersedia. Gunakan scanner handheld atau input manual.');
      }
    };
    start();
    return () => { disposed = true; cleanupScanner(); };
  }, [cleanupScanner, resolveCode]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const code = wedgeRef.current.push(event.key, event.timeStamp);
      if (code) resolveCode(code);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [resolveCode]);

  const close = () => { cleanupScanner(); onClose(); };
  return <div role="dialog" aria-modal="true" aria-label="Scanner QR dan barcode" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-lg font-bold"><Camera className="h-5 w-5 text-blue-600" /> Scan QR / Barcode</h2><p className="text-sm text-slate-500">Kamera, scanner USB/Bluetooth, atau input manual.</p></div><button aria-label="Tutup scanner" onClick={close}><X /></button></div>
      <video ref={videoRef} muted playsInline className="mt-4 aspect-video w-full rounded-xl bg-slate-900 object-cover" />
      <p className="mt-2 text-sm text-slate-600" role="status">{status}</p>
      <div className="mt-4 flex gap-2"><label className="flex-1 text-sm font-medium text-slate-700"><span className="flex items-center gap-1"><Keyboard className="h-4 w-4" /> Kode manual</span><input aria-label="Kode manual" value={manual} onChange={(event) => setManual(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); resolveCode(manual); } }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><button onClick={() => resolveCode(manual)} className="self-end rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Gunakan kode</button></div>
    </div>
  </div>;
};
export default CodeScanner;
