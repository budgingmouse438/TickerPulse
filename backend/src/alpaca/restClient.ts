import { env } from "../config/env";
import { logger } from "../logging/logger";
import { alpacaCircuitBreaker } from "./circuitBreaker";
import { alpacaRestBudget } from "./rateLimiter";

export class AlpacaUnavailableError extends Error {
  constructor() {
    super("Alpaca circuit breaker is open");
  }
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.random() * exp; // full jitter
}

/**
 * Wraps Alpaca REST calls with auth headers, exponential backoff+jitter on
 * 429/5xx, and the shared circuit breaker. Never logs the API key/secret —
 * only the request path.
 */
export async function alpacaFetch(
  path: string,
  init: RequestInit = {},
  baseUrl: string = env.alpacaBaseUrl
): Promise<Response> {
  if (alpacaCircuitBreaker.isOpen()) {
    throw new AlpacaUnavailableError();
  }

  const url = `${baseUrl}${path}`;
  const headers = {
    ...init.headers,
    "APCA-API-KEY-ID": env.alpacaApiKeyId,
    "APCA-API-SECRET-KEY": env.alpacaApiSecretKey,
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    alpacaRestBudget.recordRequest();
    let response: Response;
    try {
      response = await fetch(url, { ...init, headers });
    } catch (err) {
      logger.warn({ path, attempt, err }, "Alpaca REST call failed (network error)");
      alpacaCircuitBreaker.recordFailure();
      if (attempt === MAX_RETRIES) throw err;
      await sleep(backoffDelay(attempt));
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      logger.warn({ path, attempt, status: response.status }, "Alpaca REST call rate-limited/failed, retrying");
      alpacaCircuitBreaker.recordFailure();
      if (attempt === MAX_RETRIES) return response;
      await sleep(backoffDelay(attempt));
      continue;
    }

    alpacaCircuitBreaker.recordSuccess();
    return response;
  }

  // Unreachable, but keeps TypeScript's control-flow analysis happy.
  throw new Error("alpacaFetch: exhausted retries without returning");
}
