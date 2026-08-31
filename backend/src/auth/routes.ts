import { Router } from "express";
import { verifyPassword, verifyAgainstDummy } from "./argon2";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "./tokens";
import {
  getAccountByEmail,
  getRefreshTokenByHash,
  insertRefreshToken,
  revokeAllRefreshTokensForAccount,
  revokeRefreshToken,
} from "./repository";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  accessCookieOptions,
  refreshCookieOptions,
  clearAccessCookieOptions,
  clearRefreshCookieOptions,
} from "./session";
import { requireAuth, csrfHeaderCheck } from "./middleware";
import { closeConnectionsForAccount } from "../fanout/wsServer";
import { loginRateLimit, refreshRateLimit } from "../middleware/rateLimit";
import { logger } from "../logging/logger";

export const authRouter = Router();

function issueSession(res: import("express").Response, accountId: number): void {
  const accessToken = signAccessToken(accountId);
  const refreshToken = generateRefreshToken();
  insertRefreshToken(refreshToken.hash, accountId, refreshToken.expiresAt);
  res.cookie(ACCESS_COOKIE_NAME, accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, refreshToken.value, refreshCookieOptions());
}

authRouter.post("/login", loginRateLimit, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const account = getAccountByEmail(email);
  if (!account) {
    // Burn the same CPU time as a real verification so response timing
    // doesn't reveal whether this email exists.
    await verifyAgainstDummy(password);
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  const valid = await verifyPassword(account.password_hash, password);
  if (!valid) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  issueSession(res, account.id);
  res.status(200).json({ ok: true });
});

authRouter.post("/refresh", refreshRateLimit, (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const tokenHash = hashRefreshToken(rawToken);
  const record = getRefreshTokenByHash(tokenHash);

  if (!record) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  if (record.revoked_at) {
    // A revoked refresh token being replayed suggests it was stolen and used
    // after the legitimate client already rotated it. Revoke everything for
    // this account as a precaution.
    logger.warn({ accountId: record.account_id }, "Revoked refresh token reused — revoking all sessions");
    revokeAllRefreshTokensForAccount(record.account_id);
    res.clearCookie(ACCESS_COOKIE_NAME, clearAccessCookieOptions());
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  revokeRefreshToken(tokenHash);
  issueSession(res, record.account_id);
  res.status(200).json({ ok: true });
});

authRouter.post("/logout", requireAuth, csrfHeaderCheck, (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawToken) {
    revokeRefreshToken(hashRefreshToken(rawToken));
  }
  res.clearCookie(ACCESS_COOKIE_NAME, clearAccessCookieOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());

  if (req.accountId !== undefined) {
    closeConnectionsForAccount(req.accountId, 4001, "logged out");
  }

  res.status(200).json({ ok: true });
});
