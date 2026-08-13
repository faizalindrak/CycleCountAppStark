import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createRawMaterialItem } from '../api/materialFifoApi';
import { FieldLabel, inputClass, PageHeader, primaryButtonClass } from '../components/MaterialFifoUi';

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
    event.preventDefault(); setError(''); setSuccess('');
    const input = {
      sku: form.sku.trim(), itemCode: form.itemCode.trim(), internalProductCode: form.internalProductCode.trim(),
      itemName: form.itemName.trim(), uom: form.uom.trim().toUpperCase(),
    };
    if (Object.values(input).some((value) => !value)) return setError('Semua field wajib diisi.');
    setSaving(true);
    try {
      await createRawMaterialItem(input); await refresh(); setForm(emptyForm);
      setSuccess(`${input.sku} berhasil ditambahkan sebagai Raw Material.`);
    } catch (failure) {
      setError(failure.code === 'MF_DUPLICATE_IDENTIFIER' ? 'SKU, item code, atau internal product code sudah digunakan.' : failure.message);
    } finally { setSaving(false); }
  };

  return <section className="space-y-4">
    <PageHeader title="Kelola SKU" description="SKU baru otomatis dibuat dengan kategori Raw Material." />
    <form aria-label="Tambah SKU Raw Material" onSubmit={submit} className="max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="SKU"><input aria-label="SKU" value={form.sku} onChange={update('sku')} className={inputClass} /></FieldLabel>
        <FieldLabel label="Item code"><input aria-label="Item code" value={form.itemCode} onChange={update('itemCode')} className={inputClass} /></FieldLabel>
        <FieldLabel label="Internal product code"><input aria-label="Internal product code" value={form.internalProductCode} onChange={update('internalProductCode')} className={inputClass} /></FieldLabel>
        <FieldLabel label="UOM"><input aria-label="UOM" value={form.uom} onChange={update('uom')} placeholder="KG" className={`${inputClass} uppercase`} /></FieldLabel>
      </div>
      <FieldLabel label="Nama material"><input aria-label="Nama material" value={form.itemName} onChange={update('itemName')} className={inputClass} /></FieldLabel>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
      <div className="flex justify-end"><button disabled={saving} className={primaryButtonClass}>{saving ? 'Menambahkan...' : 'Tambah SKU'}</button></div>
    </form>
  </section>;
};

export default ManageSkuPage;
