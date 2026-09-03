import { supabase } from '../../../lib/supabase';

const ERROR_COPY = {
  MF_INACTIVE_USER: 'Akun tidak aktif.',
  MF_NOT_RAW_MATERIAL: 'SKU bukan kategori Raw Material.',
  MF_INSUFFICIENT_STOCK: 'Stok tidak mencukupi.',
  MF_INVALID_LOCATION: 'Lokasi FIFO tidak valid.',
  MF_INVALID_QUANTITY: 'Qty tidak valid.',
  MF_INVALID_MIN_MAX: 'MIN dan MAX tidak valid.',
  MF_DUPLICATE_IDENTIFIER: 'SKU atau kode sudah digunakan.',
};

export class MaterialFifoError extends Error {
  constructor(code, message, cause) {
    super(message || ERROR_COPY[code] || 'Operasi Material FIFO gagal.');
    this.name = 'MaterialFifoError';
    this.code = code || 'MF_UNKNOWN';
    this.cause = cause;
  }
}

function throwIfError(error) {
  if (!error) return;
  const rawMessage = String(error.message || '');
  const match = rawMessage.match(/(MF_[A-Z_]+):\s*(.*)/);
  throw new MaterialFifoError(match?.[1] || error.code, match?.[2] || ERROR_COPY[match?.[1]], error);
}

export async function fetchFifoMaterials() {
  const { data, error } = await supabase.from('material_fifo_stock_view').select('*').order('sku');
  throwIfError(error);
  return data ?? [];
}

export async function fetchFifoLots(itemId = null) {
  let query = supabase.from('material_fifo_lots').select('*').gt('remaining_qty', 0)
    .order('received_date').order('created_at').order('id');
  if (itemId) query = query.eq('item_id', itemId);
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}

export async function fetchFifoTransactions(filters = {}) {
  let query = supabase.from('material_fifo_transactions').select(`
    *,
    item:items(id, sku, item_name, uom, item_code, internal_product_code),
    inbound_lot:material_fifo_lots!material_fifo_lots_inbound_transaction_id_fkey(
      id, location, received_date
    ),
    allocations:material_fifo_allocations(
      id, quantity,
      lot:material_fifo_lots(id, location, received_date)
    )
  `).order('created_at', { ascending: false }).limit(filters.limit ?? 500);
  if (filters.dateFrom) query = query.gte('transaction_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('transaction_date', filters.dateTo);
  if (filters.type) query = query.eq('transaction_type', filters.type);
  if (filters.itemId) query = query.eq('item_id', filters.itemId);
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}

export async function fetchProfiles(userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return [];
  const { data, error } = await supabase.from('profiles').select('id, name, username').in('id', uniqueIds);
  throwIfError(error);
  return data ?? [];
}

async function callRpc(name, parameters) {
  const { data, error } = await supabase.rpc(name, parameters);
  throwIfError(error);
  return data;
}

export const receiveMaterial = (input) => callRpc('receive_material_fifo', {
  p_item_id: input.itemId,
  p_location: input.location,
  p_quantity: input.quantity,
  p_received_date: input.receivedDate,
  p_notes: input.notes ?? '',
  p_request_id: input.requestId,
});

export const previewIssue = (input) => callRpc('preview_material_fifo_issue', {
  p_item_id: input.itemId,
  p_quantity: input.quantity,
  p_issue_method: input.issueMethod,
  p_location: input.location || null,
});

export const issueMaterial = (input) => callRpc('issue_material_fifo', {
  p_item_id: input.itemId,
  p_quantity: input.quantity,
  p_issue_method: input.issueMethod,
  p_location: input.location || null,
  p_transaction_date: input.transactionDate,
  p_notes: input.notes ?? '',
  p_request_id: input.requestId,
  p_import_batch_id: input.importBatchId ?? null,
});

export const upsertFifoSettings = (input) => callRpc('upsert_material_fifo_settings', {
  p_item_id: input.itemId,
  p_min_qty: input.minQty,
  p_max_qty: input.maxQty,
  p_remarks: input.remarks ?? '',
});

export const createRawMaterialItem = (input) => callRpc('create_raw_material_item', {
  p_sku: input.sku,
  p_item_code: input.itemCode,
  p_internal_product_code: input.internalProductCode,
  p_item_name: input.itemName,
  p_uom: input.uom,
});

/**
 * Fetch published Google Sheet sebagai CSV.
 * Sheet harus sudah di-publish via File > Share > Publish to web (format CSV).
 * URL biasanya: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=SHEET_GID
 * atau URL publish langsung dari Google Sheets.
 *
 * Mengembalikan array of arrays (rows x cols), termasuk baris header.
 */
export async function fetchSheetCsv(url) {
  const cleanUrl = String(url).trim();
  if (!cleanUrl) throw new Error('URL Google Sheet tidak boleh kosong.');

  // Ubah URL share biasa ke format export CSV kalau perlu
  let fetchUrl = cleanUrl;
  const spreadsheetMatch = cleanUrl.match(
    /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/.*gid=(\d+))?/
  );
  if (spreadsheetMatch) {
    const sheetId = spreadsheetMatch[1];
    const gid = spreadsheetMatch[2] || '0';
    fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  let response;
  try {
    response = await fetch(fetchUrl);
  } catch {
    throw new Error('Tidak dapat terhubung ke Google Sheet. Pastikan koneksi internet aktif.');
  }
  if (!response.ok) {
    throw new Error(
      `Gagal mengambil data dari Google Sheet (HTTP ${response.status}). ` +
      'Pastikan sheet sudah di-publish sebagai CSV (File → Share → Publish to web).'
    );
  }

  const text = await response.text();
  if (!text.trim()) throw new Error('Google Sheet kosong atau tidak ada data.');

  // Parse CSV sederhana — mendukung field yang dikutip
  return parseCsv(text);
}

/** Minimal CSV parser yang mendukung quoted fields dengan koma di dalamnya. */
function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = [];
    let inQuote = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cols.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cols.push(cell.trim());
    rows.push(cols);
  }
  return rows;
}

/**
 * Ambil item-item dari Supabase berdasarkan daftar SKU.
 * Berguna untuk cek SKU mana yang sudah terdaftar sebelum migrasi.
 * Mengembalikan Map { SKU_UPPERCASE -> item_object }.
 */
export async function fetchItemsBySku(skus = []) {
  const unique = [...new Set(skus.filter(Boolean).map((s) => String(s).trim().toUpperCase()))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase
    .from('items')
    .select('id, sku, item_name, item_code, internal_product_code, uom, category')
    .in('sku', unique);
  throwIfError(error);
  return new Map((data ?? []).map((item) => [item.sku.toUpperCase(), item]));
}

/**
 * Ambil total sisa stok aktif untuk suatu item di Supabase.
 */
export async function fetchCurrentItemStock(itemId) {
  const { data, error } = await supabase
    .from('material_fifo_lots')
    .select('remaining_qty')
    .eq('item_id', itemId)
    .gt('remaining_qty', 0);
  throwIfError(error);
  const total = (data ?? []).reduce((sum, lot) => sum + (Number(lot.remaining_qty) || 0), 0);
  return Math.round(total * 10000) / 10000;
}

/**
 * Kosongkan semua sisa stok aktif untuk item tertentu menggunakan issueMaterial (FIFO).
 * Mengembalikan total qty yang berhasil dikosongkan.
 */
export async function resetItemLots(itemId, notes = 'Ganti stok dari Google Sheet') {
  const currentStock = await fetchCurrentItemStock(itemId);
  if (currentStock > 0) {
    await issueMaterial({
      itemId,
      quantity: String(currentStock),
      issueMethod: 'FIFO',
      location: null,
      transactionDate: new Date().toISOString().slice(0, 10),
      notes,
      requestId: crypto.randomUUID(),
    });
  }
  return currentStock;
}

/**
 * Ambil lot aktif berdasarkan item_id, dipakai untuk cek apakah
 * lokasi tertentu sudah ada di Supabase sebelum receive_material_fifo.
 * Mengembalikan Set lokasi (uppercase) yang masih punya remaining_qty > 0.
 */
export async function fetchActiveLotLocations(itemId) {
  const { data, error } = await supabase
    .from('material_fifo_lots')
    .select('location')
    .eq('item_id', itemId)
    .gt('remaining_qty', 0);
  throwIfError(error);
  return new Set((data ?? []).map((l) => l.location.toUpperCase()));
}
