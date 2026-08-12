import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import MaterialSearchField from './MaterialSearchField';
import { receiveMaterial } from '../api/materialFifoApi';
import { localDateInput } from '../lib/dates';

const validDecimal = (value) => /^\d+(\.\d{1,4})?$/.test(value) && Number(value) > 0;

const FifoInboundModal = ({ materials, lotsByItem, onClose, refresh }) => {
  const [item, setItem] = useState(null);
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(localDateInput());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const requestId = useRef(null);
  const existingLocation = item && (lotsByItem[item.item_id] ?? []).some((lot) => lot.location.toUpperCase() === location.trim().toUpperCase());

  const submit = async (event) => {
    event.preventDefault(); setError(''); setSuccess('');
    if (!item) return setError('Pilih material terlebih dahulu.');
    if (!/^[A-Za-z]+[0-9]+\.[0-9]+$/.test(location.trim())) return setError('Gunakan format seperti A1.1.');
    if (!validDecimal(quantity)) return setError('Qty harus positif dan maksimal 4 desimal.');
    if (!date) return setError('Tanggal masuk wajib diisi.');
    if (!navigator.onLine) return setError('Transaksi membutuhkan koneksi internet.');
    requestId.current ||= crypto.randomUUID();
    setSaving(true);
    try {
      const result = await receiveMaterial({ itemId: item.item_id, location: location.trim().toUpperCase(), quantity, receivedDate: date, notes, requestId: requestId.current });
      setSuccess(`Barang masuk tersimpan. Stok baru ${result.stock_after} ${item.uom}.`);
      await refresh(); requestId.current = null;
    } catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><form onSubmit={submit} className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between"><div><h2 className="text-xl font-bold">Barang Masuk FIFO</h2><p className="text-sm text-slate-500">Buat lot baru berdasarkan lokasi dan tanggal masuk.</p></div><button type="button" aria-label="Tutup" onClick={onClose}><X /></button></div><MaterialSearchField items={materials} value={item} onChange={setItem} label="Material masuk"/><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Lokasi FIFO<input aria-label="Lokasi FIFO" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="A1.1" className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm font-medium">Qty<input aria-label="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm font-medium">Tanggal masuk<input aria-label="Tanggal masuk" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm font-medium">Catatan<input aria-label="Catatan" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label></div>{existingLocation && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">Lokasi sudah memiliki lot. Input ini tetap disimpan sebagai lot terpisah.</p>}{error && <p role="alert" className="text-sm text-red-600">{error}</p>}{success && <p className="text-sm text-green-600">{success}</p>}<button disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan barang masuk'}</button></form></div>;
};
export default FifoInboundModal;
