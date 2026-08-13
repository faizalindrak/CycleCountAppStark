import React, { useRef, useState } from 'react';
import MaterialSearchField from './MaterialSearchField';
import { receiveMaterial } from '../api/materialFifoApi';
import { localDateInput } from '../lib/dates';
import { FieldLabel, inputClass, ModalFrame, primaryButtonClass, secondaryButtonClass } from './MaterialFifoUi';

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

  const footer = <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className={secondaryButtonClass}>Batal</button><button disabled={saving} className={primaryButtonClass}>{saving ? 'Menyimpan...' : 'Simpan barang masuk'}</button></div>;

  return <ModalFrame title="Barang Masuk FIFO" description="Buat lot baru berdasarkan lokasi dan tanggal masuk." onClose={onClose} onSubmit={submit} footer={footer}>
    <div className="space-y-4">
      <MaterialSearchField items={materials} value={item} onChange={setItem} label="Material masuk" />
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Lokasi FIFO"><input aria-label="Lokasi FIFO" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="A1.1" className={inputClass} /></FieldLabel>
        <FieldLabel label="Qty"><input aria-label="Qty" value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" className={inputClass} /></FieldLabel>
        <FieldLabel label="Tanggal masuk"><input aria-label="Tanggal masuk" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></FieldLabel>
        <FieldLabel label="Catatan"><input aria-label="Catatan" value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} /></FieldLabel>
      </div>
      {existingLocation && <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">Lokasi sudah memiliki lot. Input ini tetap disimpan sebagai lot terpisah.</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
    </div>
  </ModalFrame>;
};

export default FifoInboundModal;
