export const FIFO_STATUS = Object.freeze({
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  CRITICAL: 'CRITICAL',
  OVER: 'OVER',
  NORMAL: 'NORMAL',
});

export function getFifoStatus(stock, min, max) {
  if (min === null || min === undefined || max === null || max === undefined) {
    return FIFO_STATUS.NOT_CONFIGURED;
  }
  const quantity = Number(stock);
  if (quantity <= Number(min)) return FIFO_STATUS.CRITICAL;
  if (quantity > Number(max)) return FIFO_STATUS.OVER;
  return FIFO_STATUS.NORMAL;
}
