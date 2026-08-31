import { env } from "../config/env";
import { logger } from "../logging/logger";
import { listWatchlist } from "../watchlist/repository";
import { activeSet } from "./activeSet";
import { alpacaFetch, AlpacaUnavailableError } from "./restClient";
import { alpacaRestBudget } from "./rateLimiter";
import { broadcast } from "../fanout/broadcast";
import type { Snapshot } from "../types";

const POLL_INTERVAL_MS = 10_000;
const MAX_SYMBOLS_PER_REQUEST = 100; // comfortably under Alpaca's snapshot endpoint limits

interface SnapshotResponseEntry {
  latestTrade?: { p: number; t: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function pollOnce(): Promise<void> {
  const watchlist = listWatchlist().map((row) => row.symbol);
  const activeSymbols = new Set(activeSet.listActive());
  const symbolsToPoll = watchlist.filter((symbol) => !activeSymbols.has(symbol));

  if (symbolsToPoll.length === 0) return;

  for (const batch of chunk(symbolsToPoll, MAX_SYMBOLS_PER_REQUEST)) {
    if (!alpacaRestBudget.canMakeRequest()) {
      logger.warn("Skipping poll batch: near Alpaca REST budget for this minute");
      continue;
    }

    try {
      const response = await alpacaFetch(
        `/v2/stocks/snapshots?symbols=${encodeURIComponent(batch.join(","))}&feed=${env.alpacaDataFeed}`,
        {},
        env.alpacaDataBaseUrl
      );

      if (!response.ok) {
        logger.warn({ status: response.status }, "Alpaca snapshot poll failed");
        continue;
      }

      const body = (await response.json()) as Record<string, SnapshotResponseEntry>;
      for (const [symbol, data] of Object.entries(body)) {
        const trade = data.latestTrade;
        if (!trade) continue;
        const snapshot: Snapshot = { type: "snapshot", symbol, price: trade.p, ts: trade.t };
        broadcast(snapshot);
      }
    } catch (err) {
      if (err instanceof AlpacaUnavailableError) {
        logger.warn("Skipping poll batch: Alpaca circuit breaker open");
        broadcast({ type: "degraded", source: "alpaca", message: "Alpaca API temporarily unavailable" });
        continue;
      }
      logger.error({ err }, "Unexpected error polling Alpaca snapshots");
    }
  }
}

export function startRestPoller(): void {
  setInterval(() => {
    pollOnce().catch((err) => logger.error({ err }, "REST poller tick failed"));
  }, POLL_INTERVAL_MS).unref();
}
