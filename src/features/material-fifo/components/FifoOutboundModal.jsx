import React, { useEffect, useRef, useState } from 'react';
import MaterialSearchField from './MaterialSearchField';
import { issueMaterial, previewIssue } from '../api/materialFifoApi';
import { localDateInput } from '../lib/dates';
import { FieldLabel, inputClass, ModalFrame, secondaryButtonClass } from './MaterialFifoUi';

const validDecimal = (value) => /^\d+(\.\d{1,4})?$/.test(value) && Number(value) > 0;

const FifoOutboundModal = ({ materials, lotsByItem, onClose, refresh }) => {
  const [item, setItem] = useState(null); const [quantity, setQuantity] = useState('');
  const [method, setMethod] = useState('FIFO'); const [location, setLocation] = useState('');
  const [notes, setNotes] = useState(''); const [preview, setPreview] = useState(null);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const requestId = useRef(null);
  const locations = [...new Set((lotsByItem[item?.item_id] ?? []).filter((lot) => Number(lot.remaining_qty) > 0).map((lot) => lot.location))];
  const input = () => ({ itemId: item?.item_id, quantity, issueMethod: method, location: method === 'MANUAL' ? location : '' });
  const validate = () => { if (!item) return 'Pilih material terlebih dahulu.'; if (!validDecimal(quantity)) return 'Qty harus positif dan maksimal 4 desimal.'; if (method === 'MANUAL' && !location) return 'Pilih lokasi pengambilan.'; return ''; };
  const showPreview = async () => { const message = validate(); if (message) return setError(message); setError(''); try { setPreview(await previewIssue(input())); } catch (failure) { setError(failure.message); } };
  useEffect(() => {
    if (validate()) return undefined;
    const timer = setTimeout(showPreview, 300);
    return () => clearTimeout(timer);
  }, [item, quantity, method, location]);
  const submit = async () => { const message = validate(); if (message) return setError(message); if (!navigator.onLine) return setError('Transaksi membutuhkan koneksi internet.'); requestId.current ||= crypto.randomUUID(); setSaving(true); setError(''); try { await issueMaterial({ ...input(), transactionDate: localDateInput(), notes, requestId: requestId.current, importBatchId: null }); await refresh(); requestId.current = null; onClose(); } catch (failure) { setError(failure.message); } finally { setSaving(false); } };

  const footer = <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className={secondaryButtonClass}>Batal</button><button type="button" disabled={!preview || saving} onClick={submit} className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Memproses...' : 'Konfirmasi barang keluar'}</button></div>;

  return <ModalFrame title="Barang Keluar FIFO" description="Preview lot selalu dihitung oleh server." onClose={onClose} footer={footer}>
    <div className="space-y-4">
      <MaterialSearchField items={materials} value={item} onChange={(value) => { setItem(value); setPreview(null); }} label="Material keluar" />
      <FieldLabel label="Qty"><input aria-label="Qty" value={quantity} onChange={(event) => { setQuantity(event.target.value); setPreview(null); }} inputMode="decimal" className={inputClass} /></FieldLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Metode"><select aria-label="Metode" value={method} onChange={(event) => { setMethod(event.target.value); setPreview(null); }} className={inputClass}><option value="FIFO">Otomatis FIFO</option><option value="MANUAL">Lokasi manual</option></select></FieldLabel>
        {method === 'MANUAL' && <FieldLabel label="Lokasi"><select aria-label="Lokasi" value={location} onChange={(event) => setLocation(event.target.value)} className={inputClass}><option value="">Pilih lokasi</option>{locations.map((loc) => <option key={loc}>{loc}</option>)}</select></FieldLabel>}
      </div>
      <FieldLabel label="Catatan"><input aria-label="Catatan" value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} /></FieldLabel>
      <button type="button" onClick={showPreview} className={`${secondaryButtonClass} w-full border-blue-200 text-blue-700`}>Lihat alokasi</button>
      {preview && <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"><p className="px-3 py-2 text-xs font-semibold text-slate-700">Alokasi lot</p>{preview.allocations.map((allocation) => <div key={allocation.lot_id} className="flex justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2 text-xs"><span className="text-slate-600">{allocation.location} · {allocation.received_date}</span><b className="tabular-nums text-slate-900">{Number(allocation.quantity).toLocaleString('id-ID')} {item.uom}</b></div>)}</div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  </ModalFrame>;
};

export default FifoOutboundModal;
