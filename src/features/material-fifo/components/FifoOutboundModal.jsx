import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import MaterialSearchField from './MaterialSearchField';
import { issueMaterial, previewIssue } from '../api/materialFifoApi';
import { localDateInput } from '../lib/dates';

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
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between"><div><h2 className="text-xl font-bold">Barang Keluar FIFO</h2><p className="text-sm text-slate-500">Preview lot selalu dihitung oleh server.</p></div><button aria-label="Tutup" onClick={onClose}><X /></button></div><MaterialSearchField items={materials} value={item} onChange={(value) => { setItem(value); setPreview(null); }} label="Material keluar"/><label className="block text-sm font-medium">Qty<input aria-label="Qty" value={quantity} onChange={(e) => { setQuantity(e.target.value); setPreview(null); }} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Metode<select value={method} onChange={(e) => { setMethod(e.target.value); setPreview(null); }} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="FIFO">Otomatis FIFO</option><option value="MANUAL">Lokasi manual</option></select></label>{method === 'MANUAL' && <label className="text-sm font-medium">Lokasi<select value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Pilih lokasi</option>{locations.map((loc) => <option key={loc}>{loc}</option>)}</select></label>}</div><label className="block text-sm font-medium">Catatan<input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><button type="button" onClick={showPreview} className="w-full rounded-lg border border-blue-600 px-4 py-2 font-semibold text-blue-600">Lihat alokasi</button>{preview && <div className="rounded-xl bg-slate-50 p-3"><p className="mb-2 text-sm font-semibold">Alokasi lot</p>{preview.allocations.map((allocation) => <div key={allocation.lot_id} className="flex justify-between border-t py-2 text-sm"><span>{allocation.location} · {allocation.received_date}</span><b>{Number(allocation.quantity).toLocaleString('id-ID')} {item.uom}</b></div>)}</div>}{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button type="button" disabled={!preview || saving} onClick={submit} className="w-full rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Memproses...' : 'Konfirmasi barang keluar'}</button></div></div>;
};
export default FifoOutboundModal;
