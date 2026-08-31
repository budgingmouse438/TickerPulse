# Stock Viewer Bot — Design Doc

## Overview

A web app that shows live-ish stock prices sourced from Alpaca. A user browses a
watchlist of tickers; anything they click/pin becomes "active" and switches to a
true real-time feed over Alpaca's websocket. Everything else on the watchlist keeps
updating in the background via periodic REST calls (~every 10s) instead of holding
a live stream open.

## Constraints (why a backend is required)

This app targets Alpaca's **free IEX market data plan**, which comes with limits
that shape the whole architecture:

- **One concurrent websocket connection per API key.** Alpaca's Basic/free plan
  allows a single concurrent stock stream connection per account, and a browser
  tab holding the raw Alpaca keys would make that impossible to coordinate across
  multiple users/tabs.
- **Symbol subscription cap on the free IEX feed.** The Basic plan caps
  trade+quote subscriptions at **30 symbols** at a time (minute bars are
  uncapped), so "active" tickers must be a bounded, actively-managed set, not
  "subscribe to everything the user has ever viewed." See
  [SECURITY.md](./SECURITY.md) for how the app enforces a safety margin below
  this cap.
- **REST rate limits: 200 requests/minute per account** on the free/Basic plan
  (both Trading API and Market Data API). Polling the inactive watchlist every
  10s must batch symbols into as few requests as possible rather than one
  request per symbol per tick, and stay well under this ceiling with margin.
- **API keys must stay server-side.** Alpaca keys (even paper-trading ones)
  should never be shipped to the browser.

Together these mean the browser **never talks to Alpaca directly**. A backend
sits in between, owns the single Alpaca connection, and relays data to as many
browser clients as are connected.

## Architecture

```
 Alpaca (IEX WS)  <---->  Backend: Alpaca WS Manager   \
                                                          >---> Client Fan-out (WS/SSE) ---> Browser tab(s)
 Alpaca (REST)    <---->  Backend: REST Poller (10s)   /
```

**Backend responsibilities:**

- **Alpaca WS Manager** — owns the single websocket connection to Alpaca. Sends
  `subscribe`/`unsubscribe` messages as tickers become active/inactive. Handles
  reconnect/backoff if the stream drops.
- **REST Poller** — on a ~10s interval, fetches latest quote/trade snapshots for
  every symbol on the watchlist that is *not* currently active, batching symbols
  into as few Alpaca API calls as the endpoint allows.
- **Client Fan-out** — the backend's own WebSocket (or SSE) endpoint that browser
  tabs connect to. Pushes both live ticks (from the Alpaca WS Manager) and
  polled snapshots (from the REST Poller) to whichever clients care about that
  symbol. This is what decouples "how many browser tabs are open" from "how many
  Alpaca connections/subscriptions exist."

## Active-ticker lifecycle

1. User clicks/pins a ticker in the UI → frontend tells the backend "activate
   SYMBOL" over the client channel.
2. Backend adds SYMBOL to the active set and subscribes it on the Alpaca WS
   Manager (if not already subscribed by another user/tab watching the same
   symbol) — the active set is shared, not per-connection, so two users pinning
   AAPL only costs one Alpaca subscription.
3. Backend removes SYMBOL from the 10s REST poll list while it's active.
4. On unpin, or when the last client watching a symbol disconnects, the backend
   unsubscribes it from Alpaca and moves it back to the 10s-polled set.
5. **Cap:** the active set has a hard ceiling tied to the IEX subscription limit
   (leave headroom below Alpaca's actual max). If a new activation would exceed
   the cap, reject it or evict the least-recently-viewed active symbol.
6. **Idle timeout:** an active symbol with no connected client watching it for
   some grace period (e.g. 60s) is auto-deactivated, so a forgotten open tab
   doesn't permanently hold a subscription slot.

## Data contracts (rough shape)

**Backend → frontend push messages:**

```json
// live tick (from Alpaca WS, only for active symbols)
{ "type": "tick", "symbol": "AAPL", "price": 231.42, "ts": "2026-08-31T20:14:02Z" }

// polled snapshot (from REST poller, ~every 10s, for inactive symbols)
{ "type": "snapshot", "symbol": "MSFT", "price": 512.10, "ts": "2026-08-31T20:14:00Z" }
```

**Frontend → backend control messages / REST endpoints:**

- `GET /watchlist` — current watchlist for the user.
- `POST /watchlist/:symbol` / `DELETE /watchlist/:symbol` — add/remove a symbol.
- `POST /activate/:symbol` / `POST /deactivate/:symbol` — request live vs. polled
  updates for a symbol (or send as messages over the client WS connection).

## Frontend responsibilities

- Render the watchlist with per-ticker price, and a visual indicator of
  freshness — e.g. a "live" dot for active tickers vs. a subtle "updated Xs ago"
  for polled ones.
- On ticker click, send the activate message and switch that row into "live"
  mode; on navigating away/closing, send deactivate.
- Reconcile incoming `tick`/`snapshot` messages by symbol regardless of source,
  so the UI doesn't need to care which feed a given update came from.

## Open questions / future work

- **Stack**: language/framework for backend and frontend not yet decided.
- **Auth / multi-user**: single-user tool for now, or does the active-ticker set
  need to be scoped per-user rather than shared globally?
- **Historical/chart data**: out of scope for now — this doc covers live price
  display only.
- **Behavior at the active-ticker cap**: reject new activations vs. evict the
  least-recently-viewed symbol — needs a decision once the cap is known.
- **Reconnect UX**: what the frontend shows while the backend's Alpaca stream is
  reconnecting.
