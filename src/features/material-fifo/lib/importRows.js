const normalize = (value) => String(value ?? '').trim();
const normalizedSku = (value) => normalize(value).toUpperCase();
const isRawMaterial = (item) => normalize(item?.category).toLowerCase() === 'raw material';

function result(rows) {
  return {
    rows,
    validRows: rows.filter((row) => row.valid),
    invalidRows: rows.filter((row) => !row.valid),
  };
}

function headerIndexes(headers, aliases) {
  const normalized = (headers ?? []).map((value) => normalize(value).toUpperCase());
  return Object.fromEntries(Object.entries(aliases).map(([key, values]) => [
    key,
    normalized.findIndex((header) => values.includes(header)),
  ]));
}

function errorRow(rowNumber, code, reason, extra = {}) {
  return { rowNumber, valid: false, code, reason, ...extra };
}

export function parseMinMaxRows(sheetRows = [], items = []) {
  const indexes = headerIndexes(sheetRows[0], {
    sku: ['SKU', 'SKU#'],
    min: ['MIN'],
    max: ['MAX'],
  });
  if (indexes.sku < 0 || indexes.min < 0 || indexes.max < 0) {
    return result([errorRow(1, 'MISSING_HEADERS', 'Header SKU, MIN, dan MAX wajib tersedia')]);
  }

  const itemMap = new Map(items.map((item) => [normalizedSku(item.sku), item]));
  const seen = new Set();
  const rows = sheetRows.slice(1).flatMap((source, index) => {
    const rowNumber = index + 2;
    const sku = normalize(source?.[indexes.sku]);
    const minRaw = source?.[indexes.min];
    const maxRaw = source?.[indexes.max];
    if (!sku && normalize(minRaw) === '' && normalize(maxRaw) === '') return [];
    const key = normalizedSku(sku);
    const item = itemMap.get(key);
    const min = Number(minRaw);
    const max = Number(maxRaw);
    const base = { rowNumber, sku, item, min, max };

    if (!sku) return [errorRow(rowNumber, 'EMPTY_SKU', 'SKU kosong', base)];
    if (seen.has(key)) return [errorRow(rowNumber, 'DUPLICATE_SKU', 'SKU duplikat dalam file', base)];
    seen.add(key);
    if (!item) return [errorRow(rowNumber, 'UNKNOWN_SKU', 'SKU belum terdaftar', base)];
    if (!isRawMaterial(item)) return [errorRow(rowNumber, 'NOT_RAW_MATERIAL', 'SKU bukan Raw Material', base)];
    if (normalize(minRaw) === '' || normalize(maxRaw) === '' || !Number.isFinite(min) || !Number.isFinite(max)) {
      return [errorRow(rowNumber, 'INVALID_NUMBER', 'MIN dan MAX harus berupa angka', base)];
    }
    if (min < 0 || max < 0) return [errorRow(rowNumber, 'NEGATIVE_VALUE', 'MIN dan MAX tidak boleh negatif', base)];
    if (min > max) return [errorRow(rowNumber, 'MIN_GREATER_THAN_MAX', 'MIN tidak boleh lebih besar dari MAX', base)];
    return [{ ...base, valid: true, code: null, reason: '' }];
  });
  return result(rows);
}

export function parseOutboundRows(sheetRows = [], items = []) {
  const indexes = headerIndexes(sheetRows[0], {
    sku: ['SKU', 'SKU#'],
    quantity: ['QTY', 'QTY KELUAR', 'QUANTITY'],
    location: ['LOKASI', 'LOC', 'LOCATION'],
  });
  if (indexes.sku < 0 || indexes.quantity < 0) {
    return result([errorRow(1, 'MISSING_HEADERS', 'Header SKU dan QTY wajib tersedia')]);
  }

  const itemMap = new Map(items.map((item) => [normalizedSku(item.sku), item]));
  const rows = sheetRows.slice(1).flatMap((source, index) => {
    const rowNumber = index + 2;
    const sku = normalize(source?.[indexes.sku]);
    const quantityRaw = source?.[indexes.quantity];
    const location = indexes.location >= 0 ? normalize(source?.[indexes.location]).toUpperCase() : '';
    if (!sku && normalize(quantityRaw) === '' && !location) return [];
    const item = itemMap.get(normalizedSku(sku));
    const quantity = Number(quantityRaw);
    const base = { rowNumber, sku, item, quantity, location };
    if (!item) return [errorRow(rowNumber, 'UNKNOWN_SKU', 'SKU belum terdaftar', base)];
    if (!isRawMaterial(item)) return [errorRow(rowNumber, 'NOT_RAW_MATERIAL', 'SKU bukan Raw Material', base)];
    if (!Number.isFinite(quantity) || quantity <= 0) return [errorRow(rowNumber, 'INVALID_QUANTITY', 'QTY harus lebih dari nol', base)];
    if (quantity > Number(item.stock_qty ?? 0)) return [errorRow(rowNumber, 'INSUFFICIENT_STOCK', 'QTY melebihi stok tersedia', base)];
    return [{ ...base, valid: true, code: null, reason: '' }];
  });
  return result(rows);
}
