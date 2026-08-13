import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8');

function loadServiceWorker({ fetchMock, cachesMock }) {
  const handlers = {};
  const self = {
    location: { origin: 'https://app.test' },
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
    addEventListener: vi.fn((type, handler) => { handlers[type] = handler; }),
  };
  runInNewContext(source, {
    self,
    caches: cachesMock,
    fetch: fetchMock,
    URL,
    Response: { error: vi.fn() },
    Promise,
  });
  return handlers;
}

describe('service worker network-first handler', () => {
  it('clones a successful response before asynchronous cache opening', async () => {
    let resolveOpen;
    const cachePut = vi.fn().mockResolvedValue();
    const openPromise = new Promise((resolve) => { resolveOpen = resolve; });
    const clone = vi.fn(() => ({ cachedCopy: true }));
    const response = { ok: true, clone };
    const cachesMock = {
      open: vi.fn(() => openPromise),
      match: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
    };
    const handlers = loadServiceWorker({
      fetchMock: vi.fn().mockResolvedValue(response),
      cachesMock,
    });
    let responsePromise;
    let cachePromise;
    const event = {
      request: { method: 'GET', url: 'https://app.test/material-fifo/data', mode: 'navigate' },
      respondWith: vi.fn((promise) => { responsePromise = promise; }),
      waitUntil: vi.fn((promise) => { cachePromise = promise; }),
    };

    handlers.fetch(event);
    await expect(responsePromise).resolves.toBe(response);
    expect(clone).toHaveBeenCalledTimes(1);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);

    resolveOpen({ put: cachePut });
    await cachePromise;
    expect(cachePut).toHaveBeenCalledWith(event.request, { cachedCopy: true });
  });

  it('does not intercept cross-origin Supabase requests', () => {
    const handlers = loadServiceWorker({
      fetchMock: vi.fn(),
      cachesMock: { open: vi.fn(), match: vi.fn(), keys: vi.fn() },
    });
    const event = {
      request: { method: 'GET', url: 'https://project.supabase.co/auth/v1/user' },
      respondWith: vi.fn(),
      waitUntil: vi.fn(),
    };

    handlers.fetch(event);
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('uses a new app-shell cache version for the fixed worker', () => {
    expect(source).toContain("const CACHE_NAME = 'warehouse-app-shell-v2'");
  });
});
