import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OverviewPage from '../features/material-fifo/pages/OverviewPage';
import DataFifoPage from '../features/material-fifo/pages/DataFifoPage';
import TransactionsPage from '../features/material-fifo/pages/TransactionsPage';
import ManageSkuPage from '../features/material-fifo/pages/ManageSkuPage';
import { createRawMaterialItem, upsertFifoSettings } from '../features/material-fifo/api/materialFifoApi';

vi.mock('../features/material-fifo/api/materialFifoApi', () => ({
  upsertFifoSettings: vi.fn(),
  createRawMaterialItem: vi.fn(),
}));

const materials = [
  { item_id: '1', sku: 'RM-01', item_code: 'PROD-A', item_name: 'Resin A', internal_product_code: 'INT-A', uom: 'KG', stock_qty: '5', min_qty: '5', max_qty: '10', fifo_status: 'CRITICAL' },
  { item_id: '2', sku: 'RM-02', item_code: 'PROD-B', item_name: 'Resin B', internal_product_code: 'INT-B', uom: 'KG', stock_qty: '12', min_qty: '5', max_qty: '10', fifo_status: 'OVER' },
  { item_id: '3', sku: 'RM-03', item_code: 'PROD-C', item_name: 'Resin C', internal_product_code: 'INT-C', uom: 'KG', stock_qty: '7', min_qty: '5', max_qty: '10', fifo_status: 'NORMAL' },
  { item_id: '4', sku: 'RM-04', item_code: 'PROD-D', item_name: 'Resin D', internal_product_code: 'INT-D', uom: 'KG', stock_qty: '0', min_qty: null, max_qty: null, fifo_status: 'NOT_CONFIGURED' },
];
const lotsByItem = {
  1: [
    { id: 'new', location: 'A1.2', received_date: '2026-08-03', remaining_qty: '2' },
    { id: 'old', location: 'A1.1', received_date: '2026-08-01', remaining_qty: '3' },
  ],
};
const transactions = [
  { id: 'tx-in', transaction_type: 'IN', transaction_date: '2026-08-10', quantity: '10', inbound_lot: { location: 'A1.1' }, created_by: 'user-1', item: { sku: 'RM-01', item_name: 'Resin A', uom: 'KG' }, allocations: [] },
  { id: 'tx-out', transaction_type: 'OUT', transaction_date: '2026-08-12', quantity: '4', selected_location: 'A1.1', created_by: 'user-2', item: { sku: 'RM-02', item_name: 'Resin B', uom: 'KG' }, allocations: [
    { id: 'a2', quantity: '1', lot: { location: 'A2.1', received_date: '2026-08-05' } },
    { id: 'a1', quantity: '3', lot: { location: 'A1.1', received_date: '2026-08-01' } },
  ] },
];
const profiles = { 'user-1': { name: 'Siti' }, 'user-2': { name: 'Budi' } };

describe('Material FIFO pages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders status and no-lot KPI counts', () => {
    render(<OverviewPage materials={materials} lotsByItem={lotsByItem} />);
    expect(screen.getByTestId('kpi-critical')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-over')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-no-lot')).toHaveTextContent('3');
    expect(screen.getByText('RM-01')).toBeInTheDocument();
  });

  it('renders Overview attention items with explicit status text', () => {
    render(<OverviewPage materials={materials} lotsByItem={lotsByItem} />);

    const attentionTable = screen.getByRole('table', { name: 'Material perlu perhatian' });
    expect(attentionTable).toBeInTheDocument();
    expect(within(attentionTable).getByText('Kritis')).toBeInTheDocument();
    expect(within(attentionTable).getByText('Over')).toBeInTheDocument();
  });

  it('searches internal code and orders lots oldest first', () => {
    render(<MemoryRouter><DataFifoPage materials={materials} lotsByItem={lotsByItem} /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Cari SKU/i), { target: { value: 'INT-A' } });
    expect(screen.getByText('Resin A')).toBeInTheDocument();
    expect(screen.queryByText('Resin B')).not.toBeInTheDocument();
    const chips = screen.getAllByTestId('lot-chip');
    expect(chips[0]).toHaveTextContent('A1.1');
    expect(chips[1]).toHaveTextContent('A1.2');
  });

  it('renders Data FIFO as a dynamic semantic FIFO table', () => {
    render(<MemoryRouter><DataFifoPage materials={materials} lotsByItem={lotsByItem} /></MemoryRouter>);

    expect(screen.getByRole('table', { name: 'Data FIFO material' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'SKU' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'FIFO 1' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'FIFO 2' })).toBeInTheDocument();
    expect(screen.getByText('PROD-A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atur MIN/MAX RM-01' })).toBeInTheDocument();
    expect(screen.getAllByTestId('lot-chip')[0]).toHaveTextContent('A1.1');
  });

  it('shows one table empty state after filtering', () => {
    render(<MemoryRouter><DataFifoPage materials={materials} lotsByItem={lotsByItem} /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText(/Cari SKU/i), { target: { value: 'tidak-ada' } });
    expect(screen.getByText('Tidak ada item ditemukan')).toBeInTheDocument();
  });

  it('validates and saves individual MIN/MAX settings', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue();
    upsertFifoSettings.mockResolvedValue({ item_id: '1' });
    render(<MemoryRouter><DataFifoPage materials={materials} lotsByItem={lotsByItem} refresh={refresh} /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: /Atur MIN\/MAX RM-01/i }));
    expect(screen.getByLabelText('MIN')).toHaveValue('5');
    expect(screen.getByLabelText('MAX')).toHaveValue('10');
    await user.clear(screen.getByLabelText('MIN'));
    await user.type(screen.getByLabelText('MIN'), '12');
    await user.click(screen.getByRole('button', { name: /Simpan pengaturan/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/MIN tidak boleh lebih besar/i);

    await user.clear(screen.getByLabelText('MIN'));
    await user.type(screen.getByLabelText('MIN'), '7.5');
    await user.type(screen.getByLabelText('Catatan MIN/MAX'), 'Safety stock');
    await user.click(screen.getByRole('button', { name: /Simpan pengaturan/i }));
    expect(upsertFifoSettings).toHaveBeenCalledWith({ itemId: '1', minQty: '7.5', maxQty: '10', remarks: 'Safety stock' });
    expect(refresh).toHaveBeenCalled();
  });

  it('filters immutable history and expands FIFO allocations', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TransactionsPage transactions={transactions} profiles={profiles} /></MemoryRouter>);
    await user.selectOptions(screen.getByLabelText('Tipe transaksi'), 'OUT');
    await user.type(screen.getByPlaceholderText(/Cari SKU, lokasi, atau user/i), 'Budi');
    expect(screen.getByText('RM-02')).toBeInTheDocument();
    expect(screen.queryByText('RM-01')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Lihat alokasi RM-02/i }));
    const allocations = screen.getAllByTestId('allocation-row');
    expect(allocations[0]).toHaveTextContent('A1.1');
    expect(allocations[1]).toHaveTextContent('A2.1');
    expect(screen.queryByRole('button', { name: /hapus|edit/i })).not.toBeInTheDocument();
  });

  it('renders transaction history in a labelled responsive table', () => {
    render(<MemoryRouter><TransactionsPage transactions={transactions} profiles={profiles} /></MemoryRouter>);

    expect(screen.getByRole('table', { name: 'Riwayat transaksi FIFO' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'User' })).toBeInTheDocument();
  });

  it('creates a complete SKU as Raw Material without an editable category', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue();
    createRawMaterialItem.mockResolvedValue({ sku: 'RM-99' });
    render(<MemoryRouter><ManageSkuPage refresh={refresh} /></MemoryRouter>);
    expect(screen.queryByLabelText('Kategori')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('SKU'), ' RM-99 ');
    await user.type(screen.getByLabelText('Item code'), ' IT-99 ');
    await user.type(screen.getByLabelText('Internal product code'), ' INT-99 ');
    await user.type(screen.getByLabelText('Nama material'), 'Resin Baru');
    await user.type(screen.getByLabelText('UOM'), 'kg');
    await user.click(screen.getByRole('button', { name: /Tambah SKU/i }));
    expect(createRawMaterialItem).toHaveBeenCalledWith({ sku: 'RM-99', itemCode: 'IT-99', internalProductCode: 'INT-99', itemName: 'Resin Baru', uom: 'KG' });
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText(/RM-99 berhasil ditambahkan/i)).toBeInTheDocument();
  });
});
