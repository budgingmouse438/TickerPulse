import { env } from "../config/env";
import { logger } from "../logging/logger";
import { alpacaWsManager } from "./wsManager";

interface ActiveEntry {
  watcherCount: number;
  lastViewedAt: number;
}

export class ActiveSetFullError extends Error {
  constructor() {
    super(`Active ticker set is full (max ${env.alpacaActiveSymbolCap} symbols)`);
  }
}

/**
 * The shared set of "active" (live-streamed) symbols. Shared across all
 * connected clients of the single account — two tabs pinning the same
 * symbol cost one Alpaca subscription, per DESIGN.md. Enforces a cap safely
 * below Alpaca's 30-symbol trade/quote subscription limit and evicts
 * symbols nobody is watching after an idle grace period.
 */
class ActiveSet {
  private entries = new Map<string, ActiveEntry>();

  isActive(symbol: string): boolean {
    return this.entries.has(symbol);
  }

  activate(symbol: string): void {
    const existing = this.entries.get(symbol);
    if (existing) {
      existing.watcherCount += 1;
      existing.lastViewedAt = Date.now();
      return;
    }

    if (this.entries.size >= env.alpacaActiveSymbolCap) {
      throw new ActiveSetFullError();
    }

    this.entries.set(symbol, { watcherCount: 1, lastViewedAt: Date.now() });
    alpacaWsManager.subscribe(symbol);
    logger.info({ symbol, activeCount: this.entries.size }, "Symbol activated");
  }

  deactivate(symbol: string): void {
    const existing = this.entries.get(symbol);
    if (!existing) return;
    existing.watcherCount = Math.max(0, existing.watcherCount - 1);
    existing.lastViewedAt = Date.now();
    // Actual unsubscribe happens via the idle sweep below, after the grace
    // period, so a quick unpin/re-pin doesn't churn the Alpaca subscription.
  }

  private sweepIdle(): void {
    const cutoff = Date.now() - env.activeIdleTimeoutSec * 1000;
    for (const [symbol, entry] of this.entries) {
      if (entry.watcherCount === 0 && entry.lastViewedAt <= cutoff) {
        this.entries.delete(symbol);
        alpacaWsManager.unsubscribe(symbol);
        logger.info({ symbol, activeCount: this.entries.size }, "Symbol deactivated (idle timeout)");
      }
    }
  }

  listActive(): string[] {
    return Array.from(this.entries.keys());
  }

  startIdleSweep(): void {
    setInterval(() => this.sweepIdle(), 10_000).unref();
  }
}

export const activeSet = new ActiveSet();
