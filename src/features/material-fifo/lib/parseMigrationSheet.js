/**
 * parseMigrationSheet.js
 * Parser untuk format Google Sheet lama Material FIFO.
 *
 * Format sheet yang diharapkan:
 * - Header row: SKU# / SKU, Product Name, Product Code, UOM, MIN, MAX, STOCK,
 *               FIFO1 | QTY | TANGGAL | FIFO2 | QTY | TANGGAL | ... (jumlah slot bebas)
 * - Data mulai baris kedua (setelah header)
 * - Kolom FIFO dideteksi otomatis dari header yang dimulai dengan "FIFO"
 */

const LOC_REGEX = /^[A-Za-z]+[0-9]+\.[0-9]+$/;

/**
 * Konversi berbagai format tanggal ke string ISO 'YYYY-MM-DD'.
 * Mendukung:
 *   - Date object
 *   - Excel serial number (angka, epoch 1900-01-01)
 *   - String 'dd/MM/yyyy'
 *   - String 'yyyy-MM-dd'
 * Mengembalikan null jika tidak valid.
 */
export function parseTanggalToIso(value) {
  if (value === null || value === undefined || value === '') return null;

  // Date object
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  // Excel serial number (angka bulat, umumnya > 40000 untuk tahun 2009+)
  if (typeof value === 'number') {
    // Excel epoch: 25569 = 1970-01-01 dalam serial Excel (Windows base 1900)
    const EXCEL_EPOCH_OFFSET = 25569;
    const MS_PER_DAY = 86400 * 1000;
    // Koreksi bug Excel 1900 leap year
    const corrected = value > 59 ? value - 1 : value;
    const d = new Date((corrected - EXCEL_EPOCH_OFFSET) * MS_PER_DAY);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Format dd/MM/yyyy
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // Format yyyy-MM-dd (ISO)
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return str;

  // Fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

function normalize(v) {
  return String(v ?? '').trim();
}

function normalizeUpper(v) {
  return normalize(v).toUpperCase();
}

function headerIndexes(headerRow) {
  const col = {
    sku: -1,
    name: -1,
    code: -1,
    uom: -1,
    min: -1,
    max: -1,
    stock: -1,
    fifos: [], // [{fifoCol, qtyCol, tglCol}] semua 0-based
  };

  for (let c = 0; c < headerRow.length; c++) {
    const h = normalizeUpper(headerRow[c]);
    if (h === 'SKU#' || h === 'SKU') col.sku = c;
    else if (h === 'PRODUCT NAME') col.name = c;
    else if (h === 'PRODUCT CODE') col.code = c;
    else if (h === 'STOCK UOM' || h === 'UOM') col.uom = c;
    else if (h === 'MIN') col.min = c;
    else if (h === 'MAX') col.max = c;
    else if (h === 'STOCK') col.stock = c;
    else if (h.startsWith('FIFO')) {
      // Slot FIFO = 3 kolom berurutan: FIFO(loc) | QTY | TANGGAL
      col.fifos.push({ fifoCol: c, qtyCol: c + 1, tglCol: c + 2 });
    }
  }

  return col;
}

/**
 * Parse rows dari Google Sheet (array of arrays) menjadi daftar item siap migrasi.
 *
 * @param {Array<Array>} sheetRows - Semua baris sheet termasuk header (baris [0])
 * @param {Array<Object>} existingItems - Item yang sudah ada di Supabase [{sku, item_id, ...}]
 * @returns {{ items: Array, validItems: Array, invalidItems: Array, missingHeaders: string[] }}
 */
export function parseMigrationSheet(sheetRows = [], existingItems = []) {
  if (!sheetRows.length) {
    return { items: [], validItems: [], invalidItems: [], missingHeaders: ['Header tidak ditemukan'] };
  }

  const col = headerIndexes(sheetRows[0]);

  // Cek header wajib
  const missingHeaders = [];
  if (col.sku < 0) missingHeaders.push('SKU / SKU#');
  if (col.name < 0) missingHeaders.push('PRODUCT NAME');
  if (col.code < 0) missingHeaders.push('PRODUCT CODE');
  if (col.uom < 0) missingHeaders.push('UOM / STOCK UOM');
  if (missingHeaders.length) {
    return { items: [], validItems: [], invalidItems: [], missingHeaders };
  }

  // Map SKU existing di Supabase untuk cek duplikat
  const existingSkuMap = new Map(
    existingItems.map((item) => [normalizeUpper(item.sku), item])
  );

  const items = [];

  for (let r = 1; r < sheetRows.length; r++) {
    const row = sheetRows[r];
    if (!row || !row.length) continue;

    const sku = normalize(row[col.sku]);
    if (!sku) continue; // skip baris kosong

    const rowNumber = r + 1; // 1-based, baris 1 adalah header
    const name = normalize(row[col.name]);
    const code = normalize(row[col.code]);
    const uom = normalizeUpper(row[col.uom]);
    const min = col.min >= 0 ? Number(row[col.min]) || 0 : 0;
    const max = col.max >= 0 ? Number(row[col.max]) || 0 : 0;
    const existingItem = existingSkuMap.get(normalizeUpper(sku));

    const errors = [];
    if (!name) errors.push('Product Name kosong');
    if (!code) errors.push('Product Code kosong');
    if (!uom) errors.push('UOM kosong');
    if (col.min >= 0 && col.max >= 0) {
      if (min < 0 || max < 0) errors.push('MIN/MAX tidak boleh negatif');
      if (min > max && max !== 0) errors.push('MIN tidak boleh lebih besar dari MAX');
    }

    // Parse semua lot FIFO yang aktif (loc tidak kosong, qty > 0)
    const lots = [];
    const lotErrors = [];
    for (const pair of col.fifos) {
      const loc = normalize(row[pair.fifoCol]);
      if (!loc) continue; // slot kosong, skip
      const qty = Number(row[pair.qtyCol]) || 0;
      const tanggalRaw = pair.tglCol < row.length ? row[pair.tglCol] : null;
      const tanggal = parseTanggalToIso(tanggalRaw);

      if (!LOC_REGEX.test(loc)) {
        lotErrors.push(`Format lokasi "${loc}" tidak valid (gunakan format A1.1)`);
        continue;
      }
      if (qty <= 0) continue; // qty 0 atau negatif → lot kosong, skip
      if (!tanggal) {
        lotErrors.push(`Tanggal lot di lokasi "${loc}" tidak valid atau kosong`);
        continue;
      }
      lots.push({ loc: loc.toUpperCase(), qty, tanggal });
    }

    const allErrors = [...errors, ...lotErrors];
    const valid = allErrors.length === 0;

    items.push({
      rowNumber,
      sku,
      name,
      code,
      // internal_product_code = product_code (confirmed by user)
      internalProductCode: code,
      uom,
      min,
      max,
      lots,
      existingItem: existingItem ?? null, // null = belum ada di Supabase
      isNew: !existingItem,
      valid,
      errors: allErrors,
    });
  }

  return {
    items,
    validItems: items.filter((i) => i.valid),
    invalidItems: items.filter((i) => !i.valid),
    missingHeaders: [],
  };
}
