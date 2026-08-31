import { Router } from "express";
import { requireAuth, csrfHeaderCheck } from "../auth/middleware";
import { isValidTicker } from "./validation";
import { addToWatchlist, listWatchlist, removeFromWatchlist, WatchlistFullError } from "./repository";
import { activeSet, ActiveSetFullError } from "../alpaca/activeSet";

export const watchlistRouter = Router();

watchlistRouter.use(requireAuth);

watchlistRouter.get("/watchlist", (_req, res) => {
  const items = listWatchlist();
  const active = new Set(activeSet.listActive());
  res.json({
    watchlist: items.map((row) => ({ symbol: row.symbol, active: active.has(row.symbol) })),
  });
});

watchlistRouter.post("/watchlist/:symbol", csrfHeaderCheck, (req, res) => {
  const symbol = (req.params.symbol ?? "").toUpperCase();
  if (!isValidTicker(symbol)) {
    res.status(400).json({ error: "invalid_symbol" });
    return;
  }
  try {
    addToWatchlist(symbol);
  } catch (err) {
    if (err instanceof WatchlistFullError) {
      res.status(409).json({ error: "watchlist_full" });
      return;
    }
    throw err;
  }
  res.status(201).json({ ok: true });
});

watchlistRouter.delete("/watchlist/:symbol", csrfHeaderCheck, (req, res) => {
  const symbol = (req.params.symbol ?? "").toUpperCase();
  if (!isValidTicker(symbol)) {
    res.status(400).json({ error: "invalid_symbol" });
    return;
  }
  removeFromWatchlist(symbol);
  activeSet.deactivate(symbol);
  res.status(200).json({ ok: true });
});

watchlistRouter.post("/activate/:symbol", csrfHeaderCheck, (req, res) => {
  const symbol = (req.params.symbol ?? "").toUpperCase();
  if (!isValidTicker(symbol)) {
    res.status(400).json({ error: "invalid_symbol" });
    return;
  }
  try {
    activeSet.activate(symbol);
  } catch (err) {
    if (err instanceof ActiveSetFullError) {
      res.status(409).json({ error: "active_set_full" });
      return;
    }
    throw err;
  }
  res.status(200).json({ ok: true });
});

watchlistRouter.post("/deactivate/:symbol", csrfHeaderCheck, (req, res) => {
  const symbol = (req.params.symbol ?? "").toUpperCase();
  if (!isValidTicker(symbol)) {
    res.status(400).json({ error: "invalid_symbol" });
    return;
  }
  activeSet.deactivate(symbol);
  res.status(200).json({ ok: true });
});
