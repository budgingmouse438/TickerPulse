## What changed

<!-- Brief description -->

## Security checklist

See [SECURITY.md](../SECURITY.md) for the full policy. Confirm each item:

- [ ] No secrets/credentials in this diff (checked, not just assumed).
- [ ] Any new call to Alpaca (or another external API) respects rate limits
      (batches requests, backs off on 429/5xx) — or this PR doesn't add one.
- [ ] Any new user-facing endpoint/WebSocket has input validation and is
      covered by rate limiting / connection limits.
- [ ] Any new dependency was checked for known vulnerabilities.
- [ ] No plaintext (HTTP/WS) transport introduced where HTTPS/WSS is
      expected.
- [ ] Logs/error messages don't leak secrets or excess personal data.

## Test plan

<!-- How was this verified? -->
