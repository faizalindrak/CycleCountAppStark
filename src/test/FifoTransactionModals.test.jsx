import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ receiveMaterial: vi.fn(), previewIssue: vi.fn(), issueMaterial: vi.fn() }));
vi.mock('../features/material-fifo/api/materialFifoApi', () => api);
vi.mock('../features/material-fifo/components/MaterialSearchField', () => ({ default: ({ items, onChange, label }) => <button onClick={() => onChange(items[0])}>Pilih {label}</button> }));

import FifoInboundModal from '../features/material-fifo/components/FifoInboundModal';
import FifoOutboundModal from '../features/material-fifo/components/FifoOutboundModal';

const materials = [{ item_id: 'i1', sku: 'RM-01', item_name: 'Resin', category: 'Raw Material', stock_qty: '20', uom: 'KG' }];

describe('FIFO transaction modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.receiveMaterial.mockResolvedValue({ stock_after: '5' });
    api.previewIssue.mockResolvedValue({ stock_before: '20', stock_after: '8', allocations: [{ lot_id: 'l1', location: 'A1.1', received_date: '2026-08-01', quantity: '10' }, { lot_id: 'l2', location: 'A2.1', received_date: '2026-08-02', quantity: '2' }] });
    api.issueMaterial.mockResolvedValue({ stock_after: '8', allocations: [] });
  });

  it('validates inbound location then saves and refreshes', async () => {
    const refresh = vi.fn();
    render(<FifoInboundModal materials={materials} lotsByItem={{ i1: [{ location: 'A1.1' }] }} onClose={vi.fn()} refresh={refresh} />);
    fireEvent.click(screen.getByText('Pilih Material masuk'));
    fireEvent.change(screen.getByLabelText(/Lokasi FIFO/i), { target: { value: 'A1-1' } });
    fireEvent.change(screen.getByLabelText(/^Qty/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan barang masuk/i }));
    expect(screen.getByText(/Gunakan format seperti A1.1/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Lokasi FIFO/i), { target: { value: 'A1.1' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan barang masuk/i }));
    await waitFor(() => expect(api.receiveMaterial).toHaveBeenCalled());
    expect(screen.getByText(/Lokasi sudah memiliki lot/i)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('previews multi-lot FIFO and commits outbound', async () => {
    render(<FifoOutboundModal materials={materials} lotsByItem={{}} onClose={vi.fn()} refresh={vi.fn()} />);
    fireEvent.click(screen.getByText('Pilih Material keluar'));
    fireEvent.change(screen.getByLabelText(/^Qty/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Lihat alokasi/i }));
    expect(await screen.findByText(/A1.1/)).toBeInTheDocument();
    expect(screen.getByText(/A2.1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Konfirmasi barang keluar/i }));
    await waitFor(() => expect(api.issueMaterial).toHaveBeenCalled());
  });
});
