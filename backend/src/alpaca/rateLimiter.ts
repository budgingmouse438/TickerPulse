import { env } from "../config/env";

/**
 * Rolling one-minute window counter capping OUR outbound REST calls to
 * Alpaca. This is independent from src/middleware/rateLimit.ts, which
 * protects our own API from client abuse — this one exists purely so we
 * never trip Alpaca's own 200/min account-wide limit.
 */
class RollingRequestCounter {
  private timestamps: number[] = [];

  private prune(now: number): void {
    const cutoff = now - 60_000;
    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
  }

  canMakeRequest(): boolean {
    this.prune(Date.now());
    return this.timestamps.length < env.alpacaRestBudgetPerMin;
  }

  recordRequest(): void {
    this.timestamps.push(Date.now());
  }

  remainingBudget(): number {
    this.prune(Date.now());
    return Math.max(0, env.alpacaRestBudgetPerMin - this.timestamps.length);
  }
}

export const alpacaRestBudget = new RollingRequestCounter();
