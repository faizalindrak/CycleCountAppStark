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
