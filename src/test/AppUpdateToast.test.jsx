import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppUpdateToast from '../components/AppUpdateToast';

describe('AppUpdateToast', () => {
  it('activates a waiting service worker and reloads once after controller change', async () => {
    const user = userEvent.setup();
    const waiting = { postMessage: vi.fn() };
    const registration = { waiting, addEventListener: vi.fn() };
    const listeners = {};
    const serviceWorker = {
      controller: {},
      register: vi.fn().mockResolvedValue(registration),
      addEventListener: vi.fn((event, callback) => { listeners[event] = callback; }),
      removeEventListener: vi.fn(),
    };
    const reload = vi.fn();
    render(<AppUpdateToast serviceWorker={serviceWorker} reload={reload} />);
    expect(await screen.findByText(/Versi aplikasi baru tersedia/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Perbarui sekarang/i }));
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    listeners.controllerchange();
    listeners.controllerchange();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('can dismiss the update without activating it', async () => {
    const user = userEvent.setup();
    const waiting = { postMessage: vi.fn() };
    const serviceWorker = {
      controller: {}, register: vi.fn().mockResolvedValue({ waiting, addEventListener: vi.fn() }),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    };
    render(<AppUpdateToast serviceWorker={serviceWorker} reload={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /Nanti/i }));
    await waitFor(() => expect(screen.queryByText(/Versi aplikasi baru tersedia/i)).not.toBeInTheDocument());
    expect(waiting.postMessage).not.toHaveBeenCalled();
  });

  it('registers the service worker only once while showing the toast', async () => {
    const serviceWorker = {
      controller: {},
      register: vi.fn().mockResolvedValue({ waiting: { postMessage: vi.fn() }, addEventListener: vi.fn() }),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    };
    render(<AppUpdateToast serviceWorker={serviceWorker} />);
    expect(await screen.findByText(/Versi aplikasi baru tersedia/i)).toBeInTheDocument();
    await waitFor(() => expect(serviceWorker.register).toHaveBeenCalledTimes(1));
  });
});
