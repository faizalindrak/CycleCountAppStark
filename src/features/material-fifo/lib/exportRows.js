const quantityText = (value) => Number(value ?? 0).toFixed(4);
const dateText = (value) => {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

export function toStockExportRows(materials = []) {
  return materials.map((material) => ({
    SKU: material.sku ?? '',
    'Item Code': material.item_code ?? '',
    'Internal Product Code': material.internal_product_code ?? '',
    'Nama Material': material.item_name ?? '',
    UOM: material.uom ?? '',
    MIN: material.min_qty == null ? '' : Number(material.min_qty),
    MAX: material.max_qty == null ? '' : Number(material.max_qty),
    Stock: Number(material.stock_qty ?? 0),
    Status: material.fifo_status ?? '',
    Keterangan: material.remarks ?? '',
    Lots: (material.lots ?? []).map((lot) => (
      `${lot.location} | ${quantityText(lot.remaining_qty)} ${material.uom ?? ''} | ${dateText(lot.received_date)}`
    )).join('\n'),
  }));
}

export function toTransactionExportRows(transactions = []) {
  return transactions.map((transaction) => ({
    'Transaction ID': transaction.id ?? '',
    'Request ID': transaction.request_id ?? '',
    Timestamp: transaction.created_at ?? '',
    Tanggal: dateText(transaction.transaction_date),
    Jenis: transaction.transaction_type ?? '',
    Metode: transaction.issue_method ?? '',
    SKU: transaction.item?.sku ?? transaction.sku ?? '',
    'Nama Material': transaction.item?.item_name ?? transaction.item_name ?? '',
    Qty: Number(transaction.quantity ?? 0),
    UOM: transaction.item?.uom ?? transaction.uom ?? '',
    'Stock Sebelum': Number(transaction.stock_before ?? 0),
    'Stock Sesudah': Number(transaction.stock_after ?? 0),
    Catatan: transaction.notes ?? '',
    User: transaction.created_by_name ?? transaction.created_by ?? '',
    Allocations: (transaction.allocations ?? []).map((allocation) => {
      const lot = allocation.lot ?? allocation.material_fifo_lots ?? {};
      return `${lot.location ?? ''} | ${quantityText(allocation.quantity)} | ${dateText(lot.received_date)}`;
    }).join('\n'),
  }));
}
