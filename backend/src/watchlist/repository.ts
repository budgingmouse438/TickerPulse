import { db } from "../db/connection";
import { env } from "../config/env";
import type { WatchlistRow } from "../types";

export class WatchlistFullError extends Error {
  constructor() {
    super(`Watchlist is full (max ${env.maxWatchlistSize} symbols)`);
  }
}

export function listWatchlist(): WatchlistRow[] {
  return db.prepare("SELECT * FROM watchlist ORDER BY added_at ASC").all() as unknown as WatchlistRow[];
}

export function addToWatchlist(symbol: string): void {
  const count = (db.prepare("SELECT COUNT(*) as count FROM watchlist").get() as { count: number }).count;
  if (count >= env.maxWatchlistSize) {
    throw new WatchlistFullError();
  }
  db.prepare("INSERT OR IGNORE INTO watchlist (symbol) VALUES (?)").run(symbol);
}

export function removeFromWatchlist(symbol: string): void {
  db.prepare("DELETE FROM watchlist WHERE symbol = ?").run(symbol);
}

export function isOnWatchlist(symbol: string): boolean {
  return db.prepare("SELECT 1 FROM watchlist WHERE symbol = ?").get(symbol) !== undefined;
}
