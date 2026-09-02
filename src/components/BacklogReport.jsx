import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Download,
  Loader2,
  LogOut,
  MapPin,
  PackageCheck,
  Plus,
  Search,
} from 'lucide-react';
import writeXlsxFile from 'write-excel-file';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const getLocalDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

const emptyForm = () => ({
  itemId: '',
  qty: '',
  transactionDate: getLocalDate(),
  supplyDestination: '',
  notes: '',
});

const BacklogReport = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [items, setItems] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filterDate, setFilterDate] = useState(getLocalDate());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [skuQuery, setSkuQuery] = useState('');
  const [showSkuOptions, setShowSkuOptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('items')
      .select('id, sku, item_name, uom, category')
      .order('sku', { ascending: true });
    if (error) throw error;
    setItems(data || []);
  }, []);

  const fetchRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory_backlogs')
      .select('*')
      .eq('transaction_date', filterDate)
      .order('created_at', { ascending: false });
    if (error) throw error;
    setRecords(data || []);
  }, [filterDate]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        await Promise.all([fetchItems(), fetchRecords()]);
      } catch (error) {
        if (active) {
          setMessage({ type: 'error', text: `Data gagal dimuat: ${error.message}` });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [fetchItems, fetchRecords]);

  useEffect(() => {
    const channel = supabase
      .channel(`inventory_backlogs_${filterDate}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_backlogs' },
        () => fetchRecords()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRecords, filterDate]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return records;
    return records.filter((record) =>
      [record.sku, record.item_name, record.supply_destination, record.backlog_notes]
        .some((value) => String(value || '').toLowerCase().includes(keyword))
    );
  }, [records, search]);

  const totalQty = useMemo(
    () => records.reduce((total, record) => total + Number(record.qty_backlog || 0), 0),
    [records]
  );

  const uniqueDestinations = useMemo(
    () => new Set(records.map((record) => record.supply_destination)).size,
    [records]
  );

  const selectedItem = items.find((item) => item.id === form.itemId);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'id')),
    [items]
  );

  const filteredItems = useMemo(() => {
    const keyword = skuQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      const matchesKeyword = !keyword
        || item.sku.toLowerCase().includes(keyword)
        || item.item_name.toLowerCase().includes(keyword);
      return matchesCategory && matchesKeyword;
    }).slice(0, 50);
  }, [items, categoryFilter, skuQuery]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCategoryChange = (event) => {
    setCategoryFilter(event.target.value);
    setSkuQuery('');
    setForm((current) => ({ ...current, itemId: '' }));
    setShowSkuOptions(false);
  };

  const selectItem = (item) => {
    setForm((current) => ({ ...current, itemId: item.id }));
    setSkuQuery(`${item.sku} - ${item.item_name}`);
    setShowSkuOptions(false);
  };

  const handleSkuKeyDown = (event) => {
    if (event.key === 'Enter' && showSkuOptions && filteredItems.length > 0) {
      event.preventDefault();
      selectItem(filteredItems[0]);
    }
    if (event.key === 'Escape') setShowSkuOptions(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const qty = Number(form.qty);
    if (!selectedItem || !Number.isInteger(qty) || qty <= 0 || !form.supplyDestination.trim()) {
      setMessage({ type: 'error', text: 'Lengkapi SKU, qty backlog, dan tujuan supply dengan benar.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.from('inventory_backlogs').insert([{
        item_id: selectedItem.id,
        sku: selectedItem.sku,
        item_name: selectedItem.item_name,
        uom: selectedItem.uom,
        qty_backlog: qty,
        transaction_date: form.transactionDate,
        supply_destination: form.supplyDestination.trim(),
        backlog_notes: form.notes.trim() || null,
        created_by: user.id,
      }]);
      if (error) throw error;

      setFilterDate(form.transactionDate);
      setForm(emptyForm());
      setSkuQuery('');
      setMessage({ type: 'success', text: `Backlog ${selectedItem.sku} berhasil dicatat.` });
      await fetchRecords();
    } catch (error) {
      setMessage({ type: 'error', text: `Gagal menyimpan backlog: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!filteredRecords.length) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk diunduh.' });
      return;
    }
    const schema = [
      { column: 'Tanggal', type: String, value: (row) => row.transaction_date, width: 14 },
      { column: 'SKU', type: String, value: (row) => row.sku, width: 18 },
      { column: 'Nama Item', type: String, value: (row) => row.item_name, width: 38 },
      { column: 'Qty Backlog', type: Number, value: (row) => Number(row.qty_backlog), width: 14 },
      { column: 'UOM', type: String, value: (row) => row.uom || '', width: 10 },
      { column: 'Tujuan Supply', type: String, value: (row) => row.supply_destination, width: 28 },
      { column: 'Keterangan Backlog', type: String, value: (row) => row.backlog_notes || '', width: 42 },
    ];
    await writeXlsxFile(filteredRecords, {
      schema,
      fileName: `report_backlog_${filterDate}.xlsx`,
      sheet: 'Report Backlog',
    });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div data-testid="backlog-report-page" className="wms-page-shell text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 border-x border-blue-100/50 bg-white/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-200">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">Warehouse insight</p>
              <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Report Backlog</h1>
              <p className="truncate text-sm text-slate-500">Pencatatan transaksi inventory backlog</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/home')} className="rounded-xl p-2.5 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500" title="Kembali ke dashboard">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/60 p-2.5 text-red-600 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400" title="Logout">
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {message && (
          <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50/90 text-emerald-800' : 'border-red-200 bg-red-50/90 text-red-800'}`} role="alert">
            {message.text}
          </div>
        )}

        <section className="wms-card-lift overflow-hidden rounded-3xl border border-blue-100/80 bg-white/95 shadow-xl shadow-blue-100/40">
          <div className="border-b border-blue-100/70 bg-gradient-to-r from-blue-50/90 via-white to-cyan-50/70 px-5 py-5 sm:px-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="rounded-xl bg-blue-600 p-1.5 text-white shadow-md shadow-blue-200"><Plus className="h-4 w-4" /></span> Transaksi Backlog Baru
            </h2>
            <p className="mt-1 text-sm text-slate-500">Tanggal otomatis terisi sesuai tanggal hari ini.</p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Kategori
              <select value={categoryFilter} onChange={handleCategoryChange} className="mt-2 w-full rounded-xl border-slate-200 bg-white px-3 py-2.5 text-slate-900 transition focus:border-blue-500 focus:ring-blue-500">
                <option value="">Semua kategori</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            <label className="relative block text-sm font-medium text-slate-700">
              SKU <span className="text-red-500">*</span>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input
                  value={skuQuery}
                  onChange={(event) => {
                    setSkuQuery(event.target.value);
                    setForm((current) => ({ ...current, itemId: '' }));
                    setShowSkuOptions(true);
                  }}
                  onFocus={() => setShowSkuOptions(true)}
                  onBlur={() => setShowSkuOptions(false)}
                  onKeyDown={handleSkuKeyDown}
                  required
                  autoComplete="off"
                  placeholder="Cari SKU atau nama item..."
                  role="combobox"
                  aria-expanded={showSkuOptions}
                  aria-controls="backlog-sku-options"
                  className="w-full rounded-xl border-slate-200 py-2.5 pl-10 pr-3 text-slate-900 transition focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              {showSkuOptions && (
                <div id="backlog-sku-options" role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-blue-100 bg-white py-1 shadow-2xl shadow-blue-100">
                  {filteredItems.length > 0 ? filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={item.id === form.itemId}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectItem(item);
                      }}
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-blue-50"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-900">{item.sku}</span>
                        <span className="block truncate text-xs font-normal text-slate-500">{item.item_name}</span>
                      </span>
                      <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-normal text-slate-600">{item.category}</span>
                    </button>
                  )) : (
                    <p className="px-3 py-4 text-center text-sm font-normal text-slate-500">SKU atau nama item tidak ditemukan.</p>
                  )}
                </div>
              )}
              {selectedItem && <span className="mt-1 block text-xs text-emerald-600">Terpilih: {selectedItem.sku} - {selectedItem.item_name}</span>}
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Tanggal
              <div className="relative mt-2">
                <CalendarDays className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input name="transactionDate" type="date" value={form.transactionDate} readOnly className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-slate-700" />
              </div>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Qty Backlog <span className="text-red-500">*</span>
              <input name="qty" type="number" min="1" step="1" value={form.qty} onChange={handleChange} required placeholder="Contoh: 120" className="mt-2 w-full rounded-xl border-slate-200 px-3 py-2.5 transition focus:border-blue-500 focus:ring-blue-500" />
              {selectedItem?.uom && <span className="mt-1 block text-xs text-slate-500">UOM: {selectedItem.uom}</span>}
            </label>

            <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
              Tujuan Supply <span className="text-red-500">*</span>
              <div className="relative mt-2">
                <MapPin className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input name="supplyDestination" value={form.supplyDestination} onChange={handleChange} required maxLength="150" placeholder="Contoh: Line Produksi 2 / Customer ABC" className="w-full rounded-xl border-slate-200 py-2.5 pl-10 pr-3 transition focus:border-blue-500 focus:ring-blue-500" />
              </div>
            </label>

            <label className="block text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
              Keterangan Backlog
              <textarea name="notes" value={form.notes} onChange={handleChange} rows="3" maxLength="1000" placeholder="Tuliskan penyebab, prioritas, atau informasi tambahan backlog" className="mt-2 w-full rounded-xl border-slate-200 px-3 py-2.5 transition focus:border-blue-500 focus:ring-blue-500" />
            </label>

            <div className="sm:col-span-2 lg:col-span-3">
              <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-5 w-5" />}
                {saving ? 'Menyimpan...' : 'Simpan Transaksi Backlog'}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="wms-card-lift rounded-2xl border border-blue-100 bg-white/95 p-4 shadow-lg shadow-blue-100/40"><p className="text-sm text-slate-500">Transaksi</p><p className="mt-1 text-2xl font-bold text-slate-950">{records.length}</p></div>
            <div className="wms-card-lift rounded-2xl border border-cyan-100 bg-white/95 p-4 shadow-lg shadow-cyan-100/40"><p className="text-sm text-slate-500">Total Qty Backlog</p><p className="mt-1 text-2xl font-bold text-blue-700">{totalQty.toLocaleString('id-ID')}</p></div>
            <div className="wms-card-lift rounded-2xl border border-indigo-100 bg-white/95 p-4 shadow-lg shadow-indigo-100/40"><p className="text-sm text-slate-500">Tujuan Supply</p><p className="mt-1 text-2xl font-bold text-slate-950">{uniqueDestinations}</p></div>
          </div>

          <div className="wms-card-lift overflow-hidden rounded-3xl border border-blue-100/80 bg-white/95 shadow-xl shadow-blue-100/40">
            <div className="flex flex-col gap-3 border-b border-blue-100/70 bg-gradient-to-r from-white to-blue-50/60 p-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Daftar Transaksi Backlog</h2>
                <p className="text-sm text-slate-500">Laporan berdasarkan tanggal transaksi</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="text-xs font-medium text-slate-600">Tanggal laporan
                  <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className="mt-1 block w-full rounded-xl border-slate-200 px-3 py-2 text-sm transition focus:border-blue-500 focus:ring-blue-500" />
                </label>
                <button onClick={handleDownload} className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"><Download className="h-4 w-4" /> Excel</button>
              </div>
            </div>
            <div className="border-b border-blue-100/70 p-4">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari SKU, item, tujuan, atau keterangan..." className="w-full rounded-xl border-slate-200 py-2 pl-10 pr-3 text-sm transition focus:border-blue-500 focus:ring-blue-500" />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Memuat data...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-14 text-center"><ClipboardList className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-medium text-slate-700">Belum ada transaksi backlog</p><p className="mt-1 text-sm text-slate-500">Data untuk tanggal {filterDate} akan tampil di sini.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50"><tr>{['SKU / Item', 'Qty', 'Tujuan Supply', 'Keterangan', 'Waktu Input'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3"><p className="font-semibold text-slate-900">{record.sku}</p><p className="mt-0.5 max-w-xs text-sm text-slate-500">{record.item_name}</p></td>
                        <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-blue-100 px-2.5 py-1 text-sm font-semibold text-blue-800">{Number(record.qty_backlog).toLocaleString('id-ID')} {record.uom || ''}</span></td>
                        <td className="px-4 py-3 text-sm text-slate-700">{record.supply_destination}</td>
                        <td className="max-w-sm px-4 py-3 text-sm text-slate-600">{record.backlog_notes || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{new Date(record.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default BacklogReport;
