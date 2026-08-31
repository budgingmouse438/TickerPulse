import path from "node:path";
import dotenv from "dotenv";

// Resolves to the project root .env regardless of whether this runs via tsx
// (from src/config) or compiled output (from dist/config) — both sit one
// level inside backend/, so the same relative depth reaches the repo root.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: optionalInt("PORT", 3000),

  alpacaApiKeyId: required("ALPACA_API_KEY_ID"),
  alpacaApiSecretKey: required("ALPACA_API_SECRET_KEY"),
  alpacaBaseUrl: process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets",
  alpacaDataBaseUrl: process.env.ALPACA_DATA_BASE_URL ?? "https://data.alpaca.markets",
  alpacaDataFeed: process.env.ALPACA_DATA_FEED ?? "iex",

  jwtSigningSecret: required("JWT_SIGNING_SECRET"),
  frontendOrigin: required("FRONTEND_ORIGIN"),

  accessTokenTtlMin: optionalInt("ACCESS_TOKEN_TTL_MIN", 15),
  refreshTokenTtlDays: optionalInt("REFRESH_TOKEN_TTL_DAYS", 30),

  alpacaActiveSymbolCap: optionalInt("ALPACA_ACTIVE_SYMBOL_CAP", 25),
  alpacaRestBudgetPerMin: optionalInt("ALPACA_REST_BUDGET_PER_MIN", 150),
  activeIdleTimeoutSec: optionalInt("ACTIVE_IDLE_TIMEOUT_SEC", 60),

  maxWatchlistSize: optionalInt("MAX_WATCHLIST_SIZE", 50),

  sqlitePath: process.env.SQLITE_PATH ?? "./data/tickerpulse.sqlite",

  trustProxy: process.env.TRUST_PROXY === "true",
} as const;
