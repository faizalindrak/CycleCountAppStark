import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  fetchFifoLots,
  fetchFifoMaterials,
  fetchFifoTransactions,
  fetchProfiles,
} from '../api/materialFifoApi';

const groupLots = (lots) => lots.reduce((groups, lot) => {
  (groups[lot.item_id] ||= []).push(lot);
  return groups;
}, {});

export function useMaterialFifoData() {
  const [state, setState] = useState({
    materials: [], lotsByItem: {}, transactions: [], profiles: {},
    loading: true, error: null, lastRefresh: null,
  });
  const mountedRef = useRef(true);
  const refreshTimer = useRef(null);

  const refresh = useCallback(async ({ background = false } = {}) => {
    if (!background) setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [materials, lots, transactions] = await Promise.all([
        fetchFifoMaterials(), fetchFifoLots(), fetchFifoTransactions(),
      ]);
      const profileRows = await fetchProfiles(transactions.map((transaction) => transaction.created_by));
      const profiles = Object.fromEntries(profileRows.map((profile) => [profile.id, profile]));
      if (mountedRef.current) {
        setState({
          materials, lotsByItem: groupLots(lots), transactions, profiles,
          loading: false, error: null, lastRefresh: new Date(),
        });
      }
    } catch (error) {
      if (mountedRef.current) {
        setState((current) => ({ ...current, loading: false, error }));
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => refresh({ background: true }), 150);
    };
    const channel = supabase.channel(`material-fifo-${Date.now()}`);
    ['material_fifo_settings', 'material_fifo_lots', 'material_fifo_transactions'].forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
    });
    channel.subscribe();
    return () => {
      mountedRef.current = false;
      clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { ...state, refresh };
}
