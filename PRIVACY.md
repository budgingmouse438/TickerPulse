# Privacy Policy

_Last updated: 2026-08-31_

TickerPulse ("the app") is a stock-price viewing tool built on Alpaca market
data. This policy explains what data the app touches and how it's handled.
It applies to the app itself, not to Alpaca's own services (see their policy
at https://alpaca.markets/legal).

## What we collect

- **Alpaca API credentials** (API key ID and secret) that you provide, so the
  app's backend can request market data on your behalf.
- **Watchlist data**: the ticker symbols you add, pin/activate, or remove.
- **Basic operational logs**: timestamps, request paths, and error info
  needed to run and debug the service. Logs are scrubbed of API keys/secrets
  before being written (see [SECURITY.md](./SECURITY.md)).

We do **not** collect names, payment details, or any data beyond what's
needed to show you stock prices. If a future version adds user accounts,
this policy will be updated before that data is collected.

## How it's used

- Credentials are used solely to authenticate requests to Alpaca's REST and
  WebSocket APIs on your behalf.
- Watchlist data is used solely to determine which tickers to poll or stream
  and to render your view of the app.
- Logs are used only for debugging and keeping the service reliable.

## What we don't do

- We do not sell, rent, or share your data with third parties.
- We do not use your data for advertising or profiling.
- We do not transmit your Alpaca credentials anywhere other than Alpaca's
  official API endpoints.

## Third parties

The app relies on **Alpaca Markets** (https://alpaca.markets) to source
market data and, if trading features are ever added, to place orders. Your
use of Alpaca's services is governed by Alpaca's own terms and privacy
policy. We do not control and are not responsible for Alpaca's data
practices.

## Data retention

- Credentials and watchlist data are retained only as long as needed to run
  the app (e.g., stored locally or in the app's own database/config). You
  can delete your data by removing your `.env` configuration or, once
  accounts exist, via an account-deletion flow.
- Logs are retained for a limited operational window and are not kept
  indefinitely.

## Security

See [SECURITY.md](./SECURITY.md) for how credentials and data are protected
technically (encryption in transit, secrets management, rate limiting, etc.).

## Children's privacy

This app is not directed at children and is not intended for use by anyone
under the age required to hold a brokerage/market-data account in their
jurisdiction.

## Changes to this policy

As the app gains features (e.g., multi-user accounts, order placement), this
policy will be updated to reflect any new data collected or new purposes,
and the "Last updated" date above will change accordingly.

## Contact

Questions about this policy can be raised via the project's GitHub Issues:
https://github.com/budgingmouse438/TickerPulse/issues
