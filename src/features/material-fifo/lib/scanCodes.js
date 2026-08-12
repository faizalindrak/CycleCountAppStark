export function normalizeScannedCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

const itemCodes = (item) => [item.sku, item.internal_product_code, item.item_code]
  .map(normalizeScannedCode)
  .filter(Boolean);

export function findItemByScannedCode(code, items = []) {
  const normalized = normalizeScannedCode(code);
  if (!normalized) return null;

  const exact = items.find((item) => itemCodes(item).includes(normalized));
  if (exact) return exact;

  const legacyCandidate = normalized.replace(/^\d+/, '');
  if (!legacyCandidate || legacyCandidate === normalized) return null;
  return items.find((item) => itemCodes(item).includes(legacyCandidate)) ?? null;
}

export class KeyboardWedgeBuffer {
  constructor({ maxGapMs = 80, minLength = 3 } = {}) {
    this.maxGapMs = maxGapMs;
    this.minLength = minLength;
    this.reset();
  }

  reset() {
    this.value = '';
    this.lastTimestamp = null;
  }

  push(key, timestamp = Date.now()) {
    if (key === 'Enter') {
      const result = this.value.length >= this.minLength ? this.value : null;
      this.reset();
      return result;
    }
    if (key.length !== 1) return null;
    if (this.lastTimestamp !== null && timestamp - this.lastTimestamp > this.maxGapMs) {
      this.value = '';
    }
    this.value += key;
    this.lastTimestamp = timestamp;
    return null;
  }
}
