import cookie from "cookie";
import type { CookieOptions } from "express";
import { env } from "../config/env";
import { verifyAccessToken, type VerifiedAccessToken } from "./tokens";

export const ACCESS_COOKIE_NAME = "tp_at";
export const REFRESH_COOKIE_NAME = "tp_rt";
export const REFRESH_COOKIE_PATH = "/api/auth/refresh";

const isProduction = env.nodeEnv === "production";

export function accessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: env.accessTokenTtlMin * 60 * 1000,
  };
}

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  };
}

// clearCookie must be called with the same identifying attributes
// (path/httpOnly/secure/sameSite) used when the cookie was set, or the
// browser won't recognize it as the same cookie to remove. maxAge is
// omitted (and deprecated on clearCookie) since clearing already implies
// immediate expiry.
export function clearAccessCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...rest } = accessCookieOptions();
  return rest;
}

export function clearRefreshCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...rest } = refreshCookieOptions();
  return rest;
}

/**
 * Single source of truth for verifying a session. Used by both the Express
 * requireAuth middleware and the raw WebSocket upgrade handler so the two
 * call sites can never drift out of sync.
 */
export function verifySessionFromCookieHeader(cookieHeader: string | undefined): VerifiedAccessToken | null {
  if (!cookieHeader) return null;
  const parsed = cookie.parse(cookieHeader);
  const token = parsed[ACCESS_COOKIE_NAME];
  if (!token) return null;
  return verifyAccessToken(token);
}
