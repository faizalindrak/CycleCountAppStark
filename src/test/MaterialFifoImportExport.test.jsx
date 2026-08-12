import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImportPage from '../features/material-fifo/pages/ImportPage';
import ExportPage from '../features/material-fifo/pages/ExportPage';
import { issueMaterial, upsertFifoSettings } from '../features/material-fifo/api/materialFifoApi';

const xlsx = vi.hoisted(() => ({
  rows: [], read: vi.fn(() => ({ SheetNames: ['Data'], Sheets: { Data: {} } })),
  sheetToJson: vi.fn(() => xlsx.rows), aoaToSheet: vi.fn((rows) => ({ rows })),
  jsonToSheet: vi.fn((rows) => ({ rows })), bookNew: vi.fn(() => ({ sheets: [] })),
  bookAppendSheet: vi.fn(), writeFile: vi.fn(),
}));

vi.mock('xlsx', () => ({
  read: xlsx.read,
  writeFile: xlsx.writeFile,
  utils: {
    sheet_to_json: xlsx.sheetToJson,
    aoa_to_sheet: xlsx.aoaToSheet,
    json_to_sheet: xlsx.jsonToSheet,
    book_new: xlsx.bookNew,
    book_append_sheet: xlsx.bookAppendSheet,
  },
}));

vi.mock('../features/material-fifo/api/materialFifoApi', () => ({
  issueMaterial: vi.fn(), upsertFifoSettings: vi.fn(),
}));

const materials = [
  { item_id: '1', id: '1', sku: 'RM-01', category: 'Raw Material', item_name: 'Resin A', uom: 'KG', stock_qty: '10', fifo_status: 'NORMAL' },
  { item_id: '2', id: '2', sku: 'RM-02', category: 'Raw Material', item_name: 'Resin B', uom: 'KG', stock_qty: '8', fifo_status: 'CRITICAL' },
];

describe('Material FIFO import and export pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    xlsx.rows = [];
    Object.defineProperty(File.prototype, 'arrayBuffer', { configurable: true, value: vi.fn().mockResolvedValue(new ArrayBuffer(8)) });
  });

  it('downloads the exact MIN/MAX template and rejects unknown SKUs before submit', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue();
    upsertFifoSettings.mockResolvedValue({});
    render(<MemoryRouter><ImportPage materials={materials} refresh={refresh} /></MemoryRouter>);
    await user.selectOptions(screen.getByLabelText('Jenis import'), 'MINMAX');
    await user.click(screen.getByRole('button', { name: /Unduh template/i }));
    expect(xlsx.aoaToSheet).toHaveBeenCalledWith([['SKU', 'MIN', 'MAX']]);
    expect(xlsx.writeFile).toHaveBeenCalledWith(expect.anything(), 'template_min_max_fifo.xlsx');

    xlsx.rows = [['SKU', 'MIN', 'MAX'], ['RM-01', 2, 5], ['MISSING', 1, 2]];
    fireEvent.change(screen.getByLabelText('File import'), { target: { files: [new File(['x'], 'minmax.xlsx')] } });
    expect(await screen.findByText(/Baris 3/)).toHaveTextContent('SKU belum terdaftar');
    await user.click(screen.getByRole('button', { name: /Proses 1 baris valid/i }));
    expect(upsertFifoSettings).toHaveBeenCalledWith({ itemId: '1', minQty: '2', maxQty: '5', remarks: '' });
    expect(refresh).toHaveBeenCalled();
  });

  it('processes outbound rows sequentially and preserves partial results', async () => {
    const user = userEvent.setup();
    issueMaterial.mockResolvedValueOnce({ stock_after: '7' }).mockRejectedValueOnce(new Error('Gangguan jaringan'));
    xlsx.rows = [['SKU', 'QTY', 'LOKASI'], ['RM-01', 3, ''], ['RM-02', 2, 'A1.1']];
    render(<MemoryRouter><ImportPage materials={materials} refresh={vi.fn().mockResolvedValue()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('File import'), { target: { files: [new File(['x'], 'out.xlsx')] } });
    await user.click(await screen.findByRole('button', { name: /Proses 2 baris valid/i }));
    await waitFor(() => expect(issueMaterial).toHaveBeenCalledTimes(2));
    expect(issueMaterial.mock.calls[0][0]).toMatchObject({ itemId: '1', issueMethod: 'FIFO', importBatchId: expect.any(String), requestId: expect.any(String) });
    expect(issueMaterial.mock.calls[1][0]).toMatchObject({ itemId: '2', issueMethod: 'MANUAL', location: 'A1.1' });
    expect(screen.getByText(/Baris 2 berhasil/i)).toBeInTheDocument();
    expect(screen.getByText(/Baris 3 gagal.*Gangguan jaringan/i)).toBeInTheDocument();
  });

  it('reuses outbound request and batch IDs when an import is retried', async () => {
    const user = userEvent.setup();
    issueMaterial.mockResolvedValue({ stock_after: '7' });
    xlsx.rows = [['SKU', 'QTY'], ['RM-01', 3]];
    render(<MemoryRouter><ImportPage materials={materials} refresh={vi.fn().mockResolvedValue()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('File import'), { target: { files: [new File(['x'], 'out.xlsx')] } });
    const processButton = await screen.findByRole('button', { name: /Proses 1 baris valid/i });
    await user.click(processButton);
    await waitFor(() => expect(issueMaterial).toHaveBeenCalledTimes(1));
    await user.click(processButton);
    await waitFor(() => expect(issueMaterial).toHaveBeenCalledTimes(2));
    expect(issueMaterial.mock.calls[1][0].requestId).toBe(issueMaterial.mock.calls[0][0].requestId);
    expect(issueMaterial.mock.calls[1][0].importBatchId).toBe(issueMaterial.mock.calls[0][0].importBatchId);
  });

  it('exports all stock or only filtered stock with lot details', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const expectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lotsByItem = { 1: [{ location: 'A1.1', remaining_qty: '3.5', received_date: '2026-08-01' }] };
    render(<MemoryRouter><ExportPage materials={materials} lotsByItem={lotsByItem} transactions={[]} profiles={{}} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /Export semua stok/i }));
    expect(xlsx.jsonToSheet.mock.calls.at(-1)[0]).toHaveLength(2);
    expect(xlsx.jsonToSheet.mock.calls.at(-1)[0][0].Lots).toContain('A1.1 | 3.5000 KG');
    expect(xlsx.writeFile).toHaveBeenLastCalledWith(expect.anything(), `stok_material_fifo_${expectedDate}.xlsx`);

    await user.type(screen.getByPlaceholderText(/Filter SKU atau nama/i), 'RM-02');
    await user.click(screen.getByRole('button', { name: /Export stok terfilter/i }));
    expect(xlsx.jsonToSheet.mock.calls.at(-1)[0]).toHaveLength(1);
    expect(xlsx.jsonToSheet.mock.calls.at(-1)[0][0].SKU).toBe('RM-02');
  });
});
