import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PwaInstallPrompt from '../components/PwaInstallPrompt';

describe('PwaInstallPrompt', () => {
  it('offers installation after the browser exposes an install prompt', async () => {
    render(<PwaInstallPrompt />);
    const prompt = { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'accepted' }) };
    const event = new Event('beforeinstallprompt');
    Object.assign(event, prompt);

    await act(async () => { fireEvent(window, event); });
    await waitFor(() => expect(screen.getByRole('button', { name: /Pasang aplikasi/i })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Pasang aplikasi/i })); });
    expect(prompt.prompt).toHaveBeenCalledTimes(1);
  });
});
