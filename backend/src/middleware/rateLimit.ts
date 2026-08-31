import rateLimit from "express-rate-limit";

// These protect OUR API from abuse (brute force, scraping, DoS-by-request).
// They are entirely separate from src/alpaca/rateLimiter.ts, which caps how
// often WE call Alpaca — the two must never be conflated or share config.

export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
