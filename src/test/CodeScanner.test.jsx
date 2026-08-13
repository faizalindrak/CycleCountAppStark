import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const zxing = vi.hoisted(() => ({ decodeFromVideoDevice: vi.fn(), reset: vi.fn() }));
vi.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: class BrowserMultiFormatReader {
    decodeFromVideoDevice(...args) { return zxing.decodeFromVideoDevice(...args); }
    reset() { return zxing.reset(); }
  },
}));

import CodeScanner from '../features/material-fifo/components/CodeScanner';

const items = [{ sku: 'RM-01', category: 'Raw Material', item_name: 'Resin' }];

describe('CodeScanner', () => {
  let stop;
  beforeEach(() => {
    stop = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    navigator.mediaDevices = { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) };
    zxing.decodeFromVideoDevice.mockImplementation((_device, _video, callback) => callback({ getText: () => 'RM-01' }, null));
    zxing.reset.mockClear();
    delete global.BarcodeDetector;
  });
  afterEach(() => vi.restoreAllMocks());

  it('uses the native BarcodeDetector when available', async () => {
    const detect = vi.fn().mockResolvedValue([{ rawValue: 'RM-01' }]);
    global.BarcodeDetector = class BarcodeDetector { detect(...args) { return detect(...args); } };
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => { queueMicrotask(callback); return 1; });
    const onSelect = vi.fn();
    render(<CodeScanner items={items} onSelect={onSelect} onClose={vi.fn()} />);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(items[0]));
    expect(detect).toHaveBeenCalled();
    expect(zxing.decodeFromVideoDevice).not.toHaveBeenCalled();
  });

  it('falls back to ZXing when native initialization fails', async () => {
    global.BarcodeDetector = class BarcodeDetector { constructor() { throw new Error('unsupported formats'); } };
    const onSelect = vi.fn();
    render(<CodeScanner items={items} onSelect={onSelect} onClose={vi.fn()} />);
    await waitFor(() => expect(zxing.decodeFromVideoDevice).toHaveBeenCalled());
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('falls back to ZXing and selects a scanned item', async () => {
    const onSelect = vi.fn();
    render(<CodeScanner items={items} onSelect={onSelect} onClose={vi.fn()} />);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(items[0]));
    expect(zxing.decodeFromVideoDevice).toHaveBeenCalled();
  });

  it('supports manual and handheld code input', async () => {
    zxing.decodeFromVideoDevice.mockImplementation(() => undefined);
    const onSelect = vi.fn();
    render(<CodeScanner items={items} onSelect={onSelect} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Scanner QR dan barcode' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Tutup scanner' })).toBeInTheDocument();
    await waitFor(() => expect(zxing.decodeFromVideoDevice).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Kode manual/i), { target: { value: 'RM-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Gunakan kode/i }));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
    onSelect.mockClear();
    for (const key of ['R', 'M', '-', '0', '1', 'Enter']) fireEvent.keyDown(window, { key });
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('reports an unknown code and cleans up on close', async () => {
    zxing.decodeFromVideoDevice.mockImplementation(() => undefined);
    const onClose = vi.fn();
    render(<CodeScanner items={items} onSelect={vi.fn()} onClose={onClose} />);
    await waitFor(() => expect(zxing.decodeFromVideoDevice).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Kode manual/i), { target: { value: 'UNKNOWN' } });
    fireEvent.click(screen.getByRole('button', { name: /Gunakan kode/i }));
    expect(screen.getByText(/Kode tidak ditemukan/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tutup scanner/i }));
    expect(zxing.reset).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
