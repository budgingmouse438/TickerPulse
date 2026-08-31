const TICKER_PATTERN = /^[A-Z]{1,6}$/;

export function isValidTicker(symbol: string): boolean {
  return TICKER_PATTERN.test(symbol);
}
