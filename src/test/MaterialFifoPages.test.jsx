import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import OverviewPage from '../features/material-fifo/pages/OverviewPage';
import DataFifoPage from '../features/material-fifo/pages/DataFifoPage';

const materials = [
  { item_id: '1', sku: 'RM-01', item_name: 'Resin A', internal_product_code: 'INT-A', uom: 'KG', stock_qty: '5', min_qty: '5', max_qty: '10', fifo_status: 'CRITICAL' },
  { item_id: '2', sku: 'RM-02', item_name: 'Resin B', internal_product_code: 'INT-B', uom: 'KG', stock_qty: '12', min_qty: '5', max_qty: '10', fifo_status: 'OVER' },
  { item_id: '3', sku: 'RM-03', item_name: 'Resin C', internal_product_code: 'INT-C', uom: 'KG', stock_qty: '7', min_qty: '5', max_qty: '10', fifo_status: 'NORMAL' },
  { item_id: '4', sku: 'RM-04', item_name: 'Resin D', internal_product_code: 'INT-D', uom: 'KG', stock_qty: '0', min_qty: null, max_qty: null, fifo_status: 'NOT_CONFIGURED' },
];
const lotsByItem = {
  1: [
    { id: 'new', location: 'A1.2', received_date: '2026-08-03', remaining_qty: '2' },
    { id: 'old', location: 'A1.1', received_date: '2026-08-01', remaining_qty: '3' },
  ],
};

describe('Material FIFO pages', () => {
  it('renders status and no-lot KPI counts', () => {
    render(<OverviewPage materials={materials} lotsByItem={lotsByItem} />);
    expect(screen.getByTestId('kpi-critical')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-over')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-no-lot')).toHaveTextContent('3');
    expect(screen.getByText('RM-01')).toBeInTheDocument();
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
});
