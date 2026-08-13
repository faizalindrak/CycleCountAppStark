import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }));

import {
  MaterialFifoError,
  fetchFifoMaterials,
  issueMaterial,
  receiveMaterial,
} from '../features/material-fifo/api/materialFifoApi';

describe('materialFifoApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries the stock view in SKU order', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ sku: 'RM-01' }], error: null });
    const select = vi.fn(() => ({ order }));
    mockSupabase.from.mockReturnValue({ select });
    await expect(fetchFifoMaterials()).resolves.toEqual([{ sku: 'RM-01' }]);
    expect(mockSupabase.from).toHaveBeenCalledWith('material_fifo_stock_view');
    expect(order).toHaveBeenCalledWith('sku');
  });

  it('maps inbound RPC parameters exactly', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { stock_after: '2.5000' }, error: null });
    await receiveMaterial({
      itemId: 'item-1', location: 'A1.1', quantity: '2.5000',
      receivedDate: '2026-08-12', notes: '', requestId: 'request-1',
    });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('receive_material_fifo', {
      p_item_id: 'item-1', p_location: 'A1.1', p_quantity: '2.5000',
      p_received_date: '2026-08-12', p_notes: '', p_request_id: 'request-1',
    });
  });

  it('maps issue parameters and stable errors', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: {}, error: null });
    await issueMaterial({ itemId: 'i', quantity: '1', issueMethod: 'FIFO', location: '', transactionDate: '2026-08-12', notes: '', requestId: 'r', importBatchId: null });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('issue_material_fifo', expect.objectContaining({ p_issue_method: 'FIFO', p_location: null }));

    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'MF_INSUFFICIENT_STOCK:Stok kurang' } });
    await expect(receiveMaterial({})).rejects.toMatchObject({
      name: 'MaterialFifoError', code: 'MF_INSUFFICIENT_STOCK', message: 'Stok kurang',
    });
    expect(MaterialFifoError).toBeTypeOf('function');
  });
});
