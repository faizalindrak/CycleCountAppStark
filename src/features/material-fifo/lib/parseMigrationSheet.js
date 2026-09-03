/**
 * parseMigrationSheet.js
 * Parser fleksibel untuk migrasi data Material FIFO.
 *
 * Mendukung 2 format sumber:
 * 1. Format Export Dashboard Lama ("stock_material_YYYY-MM-DD.xlsx")
 *    Header: SKU | Product Code | Nama Material | MIN | MAX | STOCK | UOM | Status | Lokasi FIFO (Lokasi, Qty, Tanggal)
 *    Kolom Lokasi FIFO berisi teks seperti:
 *    "D3.1 (75, 10/08/2026) | F7.7 (1.000, 25/08/2026)" atau "B6.7 (450, 24/03/2026)" atau "-"
 *
 * 2. Format Mentah Google Sheet ("Sheet1")
 *    Header: SKU# | Product Code | Product Name | Stock UOM | MIN | MAX | STOCK | FIFO1 | QTY | TANGGAL | FIFO2 ...
 *    Slot FIFO terdiri dari 3 kolom berurutan per slot.
 */

const LOC_REGEX = /^[A-Za-z]+[0-9]+\.[0-9]+$/;

/**
 * Konversi berbagai format tanggal ke string ISO 'YYYY-MM-DD'.
 */
export function parseTanggalToIso(value) {
  if (value === null || value === undefined || value === '') return null;

  // Date object
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Excel serial number (angka hari sejak 1899-12-30)
  if (typeof value === 'number') {
    const EXCEL_EPOCH_OFFSET = 25569;
    const MS_PER_DAY = 86400 * 1000;
    const corrected = value > 59 ? value - 1 : value;
    const d = new Date((corrected - EXCEL_EPOCH_OFFSET) * MS_PER_DAY);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return null;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Format dd/MM/yyyy atau d/M/yyyy
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // Format yyyy-MM-dd (ISO)
  const iso = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso) {
    const year = iso[1];
    const month = iso[2].padStart(2, '0');
    const day = iso[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback Date constructor
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Parsing angka yang fleksibel: mendukung format Indonesia (1.000 atau 6,5) dan standar (1000 atau 6.5).
 * Juga membersihkan suffix satuan seperti "KG" atau "PCS".
 */
export function parseNumberFlexible(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  // Bersihkan karakter selain angka, minus, titik, koma
  let s = String(val).trim();
  // Buang suffix text seperti "KG", "PCS", dll
  s = s.replace(/[^0-9.,\-]/g, '');
  if (!s) return 0;

  // Jika ada titik DAN koma:
  // Format Indonesia: 1.234,56 -> titik ribuan, koma desimal
  // Format Inggris: 1,234.56 -> koma ribuan, titik desimal
  if (s.includes('.') && s.includes(',')) {
    if (s.indexOf('.') < s.indexOf(',')) {
      return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return Number(s.replace(/,/g, '')) || 0;
  }

  // Jika hanya ada koma: e.g. "6,5" atau "140,14" -> koma adalah desimal
  if (s.includes(',')) {
    return Number(s.replace(',', '.')) || 0;
  }

  // Jika hanya ada titik:
  // Di Indonesia: "1.000" artinya 1000. Pola 1-3 digit diikuti tepat 3 digit (misal: 1.000, 10.000, 100.000)
  if (/^-?\d{1,3}\.\d{3}$/.test(s)) {
    return Number(s.replace('.', '')) || 0;
  }

  return Number(s) || 0;
}

/**
 * Parse teks gabungan lokasi FIFO dari satu kolom.
 * Contoh format yang didukung:
 * - "B6.7 (450, 24/03/2026)"
 * - "B5.11 (6,5, 11/01/2026)"
 * - "D3.1 (75, 10/08/2026) | F7.7 (1.000, 25/08/2026)"
 * - "C4.3 (400, 12/08/2026) | C4.3 (50, 12/08/2026)"
 * - "A1.1 | 100.0000 KG | 24/03/2026"
 * - "B6.7 (450)" (tanpa tanggal -> fallback ke hari ini)
 * - "-" atau "" -> []
 */
export function parseLotString(rawStr) {
  if (rawStr === null || rawStr === undefined) return [];
  const text = String(rawStr).trim();
  if (!text || text === '-' || text === '—') return [];

  const lots = [];
  // Split berdasarkan pemisah '|' atau baris baru '\n'
  const parts = text.split(/\s*\|\s*|\r?\n/);

  for (const part of parts) {
    const p = part.trim();
    if (!p || p === '-' || p === '—') continue;

    // Pola 1: LOC (QTY, TANGGAL) atau LOC (QTY)
    // Contoh: "B6.7 (450, 24/03/2026)" atau "B5.11 (6,5, 11/01/2026)"
    const matchParen = p.match(/^([A-Za-z0-9.]+)\s*\((.*)\)$/);
    if (matchParen) {
      const loc = matchParen[1].trim().toUpperCase();
      const inside = matchParen[2].trim();

      let qty = 0;
      let tanggal = null;

      const lastComma = inside.lastIndexOf(',');
      if (lastComma !== -1) {
        const afterComma = inside.slice(lastComma + 1).trim();
        const possibleDate = parseTanggalToIso(afterComma);
        if (possibleDate) {
          tanggal = possibleDate;
          qty = parseNumberFlexible(inside.slice(0, lastComma).trim());
        } else {
          // Jika setelah koma bukan tanggal, berarti desimal misal "6,5"
          qty = parseNumberFlexible(inside);
        }
      } else {
        qty = parseNumberFlexible(inside);
      }

      if (!tanggal) {
        tanggal = new Date().toISOString().slice(0, 10);
      }

      if (qty > 0) {
        lots.push({ loc, qty, tanggal });
      }
      continue;
    }

    // Pola 2: LOC | QTY [UOM] | TANGGAL (format export aplikasi baru)
    // Contoh: "A1.1 | 100.0000 KG | 24/03/2026"
    const matchPipe = p.match(/^([A-Za-z0-9.]+)\s*\|\s*([0-9.,]+)(?:\s+[A-Za-z]+)?(?:\s*\|\s*(.*))?$/);
    if (matchPipe) {
      const loc = matchPipe[1].trim().toUpperCase();
      const qty = parseNumberFlexible(matchPipe[2].trim());
      const rawDate = matchPipe[3]?.trim();
      const tanggal = rawDate ? parseTanggalToIso(rawDate) : new Date().toISOString().slice(0, 10);
      if (qty > 0) {
        lots.push({ loc, qty, tanggal });
      }
      continue;
    }
  }

  return lots;
}

function normalize(v) {
  return String(v ?? '').trim();
}

function normalizeUpper(v) {
  return normalize(v).toUpperCase();
}

export function headerIndexes(headerRow) {
  const col = {
    sku: -1,
    name: -1,
    code: -1,
    uom: -1,
    min: -1,
    max: -1,
    stock: -1,
    fifoSingle: -1, // Kolom tunggal "Lokasi FIFO (Lokasi, Qty, Tanggal)"
    fifos: [],      // [{fifoCol, qtyCol, tglCol}] untuk slot terpisah FIFO1, FIFO2
  };

  for (let c = 0; c < headerRow.length; c++) {
    const rawH = String(headerRow[c] ?? '').trim();
    const h = rawH.toUpperCase();
    if (!h) continue;

    if (['SKU#', 'SKU', 'KODE MATERIAL', 'PART NUMBER', 'PART NO'].includes(h)) {
      col.sku = c;
    } else if (['PRODUCT NAME', 'NAMA MATERIAL', 'NAMA ITEM', 'ITEM NAME', 'NAMA PRODUK', 'NAMA'].includes(h)) {
      col.name = c;
    } else if (['PRODUCT CODE', 'PRODUCT CODE#', 'ITEM CODE', 'ITEM CODE#', 'KODE PRODUK', 'KODE PRODUCT', 'KODE'].includes(h)) {
      col.code = c;
    } else if (['STOCK UOM', 'UOM', 'SATUAN'].includes(h)) {
      col.uom = c;
    } else if (['MIN', 'MIN QTY', 'MINIMUM'].includes(h)) {
      col.min = c;
    } else if (['MAX', 'MAX QTY', 'MAKSIMUM'].includes(h)) {
      col.max = c;
    } else if (['STOCK', 'STOK', 'STOCK QTY', 'QTY STOCK'].includes(h)) {
      col.stock = c;
    } else if (/^FIFO\d+$/i.test(h)) {
      // Slot FIFO = 3 kolom berurutan: FIFO(loc) | QTY | TANGGAL
      col.fifos.push({ fifoCol: c, qtyCol: c + 1, tglCol: c + 2 });
    } else if (
      h.includes('LOKASI FIFO') ||
      h === 'FIFO LOTS' ||
      h === 'LOTS' ||
      h === 'DETAIL FIFO' ||
      h === 'FIFO'
    ) {
      col.fifoSingle = c;
    }
  }

  return col;
}

/**
 * Parse rows dari Google Sheet / Excel (array of arrays) menjadi daftar item siap migrasi.
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

  // Cek header wajib: SKU, Nama Material / Product Name, Product Code / Item Code, UOM
  const missingHeaders = [];
  if (col.sku < 0) missingHeaders.push('SKU');
  if (col.name < 0) missingHeaders.push('Nama Material / Product Name');
  if (col.code < 0) missingHeaders.push('Product Code / Item Code');
  if (col.uom < 0) missingHeaders.push('UOM / Satuan');
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

    const rowNumber = r + 1; // 1-based
    const name = normalize(row[col.name]);
    const code = normalize(row[col.code]);
    const uom = normalizeUpper(row[col.uom]) || 'KG';
    const min = col.min >= 0 ? parseNumberFlexible(row[col.min]) : 0;
    const max = col.max >= 0 ? parseNumberFlexible(row[col.max]) : 0;
    const existingItem = existingSkuMap.get(normalizeUpper(sku));

    const errors = [];
    if (!name) errors.push('Nama Material / Product Name kosong');
    if (!code) errors.push('Product Code kosong');
    if (!uom) errors.push('UOM kosong');
    if (min < 0 || max < 0) errors.push('MIN/MAX tidak boleh negatif');
    if (min > max && max > 0) errors.push('MIN tidak boleh lebih besar dari MAX');

    // Parse lot FIFO
    let lots = [];
    const lotErrors = [];

    // Kasus 1: Kolom tunggal Lokasi FIFO (format export stock_material_...)
    if (col.fifoSingle >= 0) {
      const rawFifo = row[col.fifoSingle];
      lots = parseLotString(rawFifo);
      for (const lot of lots) {
        if (!LOC_REGEX.test(lot.loc)) {
          lotErrors.push(`Format lokasi "${lot.loc}" tidak valid (gunakan format A1.1)`);
        }
      }
    }
    // Kasus 2: Kolom slot terpisah FIFO1, QTY, TANGGAL, FIFO2, ... (Google Sheet mentah)
    else if (col.fifos.length > 0) {
      for (const pair of col.fifos) {
        const loc = normalize(row[pair.fifoCol]);
        if (!loc) continue; // slot kosong, skip
        const qty = parseNumberFlexible(row[pair.qtyCol]);
        const tanggalRaw = pair.tglCol < row.length ? row[pair.tglCol] : null;
        const tanggal = parseTanggalToIso(tanggalRaw) || new Date().toISOString().slice(0, 10);

        if (!LOC_REGEX.test(loc)) {
          lotErrors.push(`Format lokasi "${loc}" tidak valid (gunakan format A1.1)`);
          continue;
        }
        if (qty <= 0) continue; // qty 0 atau negatif → lot kosong, skip
        lots.push({ loc: loc.toUpperCase(), qty, tanggal });
      }
    }

    const allErrors = [...errors, ...lotErrors];
    const valid = allErrors.length === 0;

    items.push({
      rowNumber,
      sku,
      name,
      code,
      // internal_product_code = product_code
      internalProductCode: code,
      uom,
      min,
      max,
      lots,
      existingItem: existingItem ?? null,
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
