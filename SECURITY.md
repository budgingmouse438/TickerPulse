# Security Policy

This document defines the safety measures TickerPulse commits to, and the
checklist every change must satisfy before it merges. As of 2026-08-31, every
commit/PR to this repo is expected to be checked against this list — see
[.github/PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md) for the
enforced checklist and `.github/workflows/security.yml` for the automated
checks that run on every push.

## Threat model (what we're defending against)

- Leaked Alpaca API keys/secrets (credential theft → unauthorized trading or
  data access on the user's Alpaca account).
- Our own backend getting Alpaca's account throttled or banned by exceeding
  rate limits, taking the app down for everyone.
- Our own API/WebSocket endpoints being abused (DoS, resource exhaustion) by
  a malicious or careless client.
- Injection via user-supplied ticker symbols or other input reaching Alpaca
  calls, logs, or a database.
- Vulnerable dependencies pulling in known CVEs.
- Data exposure in transit (unencrypted connections) or in logs.

## Alpaca-specific rate limits (confirmed, free/Basic plan)

- **REST (Trading API and Market Data API): 200 requests/minute per account.**
  Exceeding this returns HTTP 429s and repeated abuse can lead to throttling.
- **WebSocket streaming: 1 concurrent connection per account**, and the
  Basic/free IEX feed caps **trade+quote subscriptions at 30 symbols** at a
  time (minute-bar subscriptions are uncapped).
- Algo Trader Plus (paid) raises the REST limit to 10,000 req/min and removes
  the symbol subscription cap — noted here in case the project upgrades later.

Source: Alpaca's published rate-limit/usage docs and support pages (verify
against https://docs.alpaca.markets before relying on exact numbers, as
Alpaca has changed these limits before).

### How the app must respect these limits

- **Single shared Alpaca WS connection.** Only the backend holds it; the
  active-ticker set (see DESIGN.md) must never exceed a configured cap set
  safely below 30 (e.g. 25) to leave headroom.
- **Batch REST polling.** The 10s poller must request multiple symbols in one
  call (Alpaca's snapshot/quotes endpoints support batching) instead of one
  request per symbol, and must track a rolling request count to stay under
  200/min with margin (e.g. target ≤150/min).
- **Exponential backoff with jitter** on any 429 or 5xx response from Alpaca,
  and on WebSocket disconnects — never tight-loop retries.
- **Circuit breaker**: if Alpaca calls keep failing, stop retrying
  aggressively and surface a degraded state to the frontend rather than
  hammering the API.

## Our own API/WebSocket surface

- **Rate limit our endpoints** (e.g. per-IP or per-session token bucket) so a
  single client can't force excessive Alpaca calls or open unbounded
  connections through our backend.
- **Cap concurrent client connections** and **cap watchlist size** per
  user/session to bound memory and the active-ticker set.
- **Idle/heartbeat timeouts** on client WebSocket connections; drop dead
  connections instead of leaking them.
- **Input validation**: ticker symbols must match a strict allow-list pattern
  (e.g. `^[A-Z]{1,6}$`) before being used in any Alpaca call, log line, or
  query — reject anything else instead of trying to sanitize it.
- **CORS**: restrict allowed origins to the app's own frontend origin(s), not
  `*`.
- **TLS everywhere**: HTTPS for REST, WSS for WebSocket, both to Alpaca and
  between our frontend and backend. No plaintext transport in any
  environment, including local dev if feasible.

## Secrets management

- Alpaca API key/secret live only in environment variables (`.env`, ignored
  by git — see `.gitignore`) or a proper secrets manager in production.
  Never in source code, logs, error messages, or client-side JS.
- `.env.example` documents required variables with empty values; real values
  never get committed. GitHub secret scanning + push protection are enabled
  on this repo to catch accidental leaks before they land.
- If a credential is ever committed or leaked, rotate it immediately in the
  Alpaca dashboard — do not just delete the commit (history is never fully
  erasable on a public repo without a force-push + key rotation).
- Logs must never contain full API keys/secrets. Scrub or redact before
  writing.

## Dependency & supply-chain hygiene

- Dependabot security updates are enabled on this repo (auto-PRs for
  vulnerable dependencies).
- Before adding any new dependency: prefer well-maintained, widely-used
  packages; check for known advisories.
- Run the ecosystem's audit tool (`npm audit` / `pip-audit`, once a stack
  exists) as part of the pre-merge checklist.
- Pin dependency versions (lockfiles committed) so builds are reproducible
  and not silently pulling in new/compromised versions.

## Automated checks (CI)

`.github/workflows/security.yml` runs on every push/PR and performs:

- **Secret scanning** (gitleaks) across the diff, as a backstop in addition
  to GitHub's native secret scanning/push protection.
- **Backend typecheck** (`tsc --noEmit`) and **dependency audit**
  (`npm audit --audit-level=high`) against `backend/`, now that a real stack
  exists there.

Still missing: linting and automated tests (no test suite exists yet for the
backend). Add a lint/test job to this same workflow once either exists —
don't let this note go stale as the codebase grows.

## Per-commit checklist

Every PR must confirm (see the PR template):

- [ ] No secrets/credentials in the diff.
- [ ] Any new external call respects Alpaca's rate limits (batching,
      backoff) or documents why it doesn't need to.
- [ ] Any new user-facing endpoint has input validation and rate limiting.
- [ ] Any new dependency has been checked for known vulnerabilities.
- [ ] No plaintext transport introduced (HTTP where HTTPS/WSS is expected).
- [ ] Logs don't leak secrets or excessive PII.

## Reporting a vulnerability

If you find a security issue in this project, please open a GitHub issue
marked clearly as a security concern, or contact the maintainer directly
rather than filing a public exploit. This is currently a small personal
project without a formal disclosure program.
