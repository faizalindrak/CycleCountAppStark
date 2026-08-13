import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createRawMaterialItem } from '../api/materialFifoApi';

const emptyForm = { sku: '', itemCode: '', internalProductCode: '', itemName: '', uom: '' };

const ManageSkuPage = (props) => {
  const outlet = useOutletContext() ?? {};
  const refresh = props.refresh ?? outlet.refresh ?? (() => Promise.resolve());
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError(''); setSuccess('');
    const input = {
      sku: form.sku.trim(), itemCode: form.itemCode.trim(),
      internalProductCode: form.internalProductCode.trim(),
      itemName: form.itemName.trim(), uom: form.uom.trim().toUpperCase(),
    };
    if (Object.values(input).some((value) => !value)) {
      setError('Semua field wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await createRawMaterialItem(input);
      await refresh();
      setForm(emptyForm);
      setSuccess(`${input.sku} berhasil ditambahkan sebagai Raw Material.`);
    } catch (failure) {
      setError(failure.code === 'MF_DUPLICATE_IDENTIFIER' ? `SKU, item code, atau internal product code sudah digunakan.` : failure.message);
    } finally {
      setSaving(false);
    }
  };

  return <section className="space-y-4">
    <div><h2 className="text-2xl font-bold text-slate-900">Kelola SKU</h2><p className="text-sm text-slate-500">SKU baru otomatis dibuat dengan kategori Raw Material.</p></div>
    <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">SKU<input aria-label="SKU" value={form.sku} onChange={update('sku')} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm font-medium">Item code<input aria-label="Item code" value={form.itemCode} onChange={update('itemCode')} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm font-medium">Internal product code<input aria-label="Internal product code" value={form.internalProductCode} onChange={update('internalProductCode')} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm font-medium">UOM<input aria-label="UOM" value={form.uom} onChange={update('uom')} placeholder="KG" className="mt-1 w-full rounded-lg border px-3 py-2 uppercase" /></label>
      </div>
      <label className="block text-sm font-medium">Nama material<input aria-label="Nama material" value={form.itemName} onChange={update('itemName')} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Menambahkan...' : 'Tambah SKU'}</button>
    </form>
  </section>;
};

export default ManageSkuPage;
