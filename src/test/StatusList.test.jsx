import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusList from '../components/StatusList';

describe('StatusList visual states', () => {
  it('uses the fresh panel styling for empty and populated status lists', () => {
    const { rerender } = render(
      <StatusList title="Open Status" items={[]} emptyMessage="No open status reports" />,
    );
    expect(screen.getByText('Open Status').closest('.rounded-3xl')).toBeInTheDocument();

    rerender(
      <StatusList
        title="Open Status"
        items={[{ id: 'r1', item_name: 'Material A', inventory_status: 'kritis', follow_up_status: 'open' }]}
        getStatusIcon={() => <span>Kritis</span>}
        getFollowUpIcon={() => <span>Open</span>}
        selectedItems={[]}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Material A').closest('div.p-4')).toHaveClass('hover:bg-blue-50/60');
  });
});
