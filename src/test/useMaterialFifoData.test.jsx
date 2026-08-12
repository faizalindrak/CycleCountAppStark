import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  fetchFifoMaterials: vi.fn(),
  fetchFifoLots: vi.fn(),
  fetchFifoTransactions: vi.fn(),
  fetchProfiles: vi.fn(),
}));
const realtime = vi.hoisted(() => ({
  callbacks: [],
  channel: { on: vi.fn(), subscribe: vi.fn() },
  removeChannel: vi.fn(),
}));

vi.mock('../features/material-fifo/api/materialFifoApi', () => api);
vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => realtime.channel),
    removeChannel: realtime.removeChannel,
  },
}));

import { useMaterialFifoData } from '../features/material-fifo/hooks/useMaterialFifoData';

const Harness = () => {
  const state = useMaterialFifoData();
  return <div>{state.loading ? 'loading' : `${state.materials.length}|${Object.keys(state.lotsByItem).length}|${state.transactions.length}`}</div>;
};

describe('useMaterialFifoData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtime.callbacks = [];
    realtime.channel.on.mockImplementation((_type, _filter, callback) => {
      realtime.callbacks.push(callback);
      return realtime.channel;
    });
    realtime.channel.subscribe.mockReturnValue(realtime.channel);
    api.fetchFifoMaterials.mockResolvedValue([{ item_id: 'i1' }]);
    api.fetchFifoLots.mockResolvedValue([{ item_id: 'i1', id: 'l1' }]);
    api.fetchFifoTransactions.mockResolvedValue([{ id: 't1', created_by: 'u1' }]);
    api.fetchProfiles.mockResolvedValue([{ id: 'u1', name: 'User' }]);
  });

  it('loads data and refreshes after a realtime event', async () => {
    render(<Harness />);
    expect(await screen.findByText('1|1|1')).toBeInTheDocument();
    await act(async () => {
      realtime.callbacks[0]();
      await new Promise((resolve) => setTimeout(resolve, 180));
    });
    expect(api.fetchFifoMaterials).toHaveBeenCalledTimes(2);
  });

  it('removes the realtime channel on unmount', async () => {
    const { unmount } = render(<Harness />);
    await waitFor(() => expect(api.fetchFifoMaterials).toHaveBeenCalled());
    unmount();
    expect(realtime.removeChannel).toHaveBeenCalledWith(realtime.channel);
  });
});
