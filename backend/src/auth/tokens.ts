import crypto from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";

export interface VerifiedAccessToken {
  accountId: number;
}

export function signAccessToken(accountId: number): string {
  return jwt.sign({ sub: String(accountId) }, env.jwtSigningSecret, {
    algorithm: "HS256",
    expiresIn: `${env.accessTokenTtlMin}m`,
  });
}

export function verifyAccessToken(token: string): VerifiedAccessToken | null {
  try {
    const decoded = jwt.verify(token, env.jwtSigningSecret, { algorithms: ["HS256"] }) as JwtPayload;
    if (typeof decoded.sub !== "string") return null;
    const accountId = Number(decoded.sub);
    if (!Number.isFinite(accountId)) return null;
    return { accountId };
  } catch {
    return null;
  }
}

export interface RawRefreshToken {
  value: string; // sent to the client in a cookie, never stored
  hash: string; // stored server-side
  expiresAt: Date;
}

export function generateRefreshToken(): RawRefreshToken {
  const value = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  return { value, hash: hashRefreshToken(value), expiresAt };
}

export function hashRefreshToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
