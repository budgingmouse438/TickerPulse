import { db } from "../db/connection";
import type { AccountRow, RefreshTokenRow } from "../types";

export function getAccount(): AccountRow | undefined {
  return db.prepare("SELECT * FROM account WHERE id = 1").get() as unknown as AccountRow | undefined;
}

export function getAccountByEmail(email: string): AccountRow | undefined {
  return db.prepare("SELECT * FROM account WHERE email = ?").get(email) as unknown as AccountRow | undefined;
}

export function upsertAccount(email: string, passwordHash: string): void {
  db.prepare(
    `INSERT INTO account (id, email, password_hash) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash`
  ).run(email, passwordHash);
}

export function insertRefreshToken(tokenHash: string, accountId: number, expiresAt: Date): void {
  db.prepare(
    "INSERT INTO refresh_tokens (token_hash, account_id, expires_at) VALUES (?, ?, ?)"
  ).run(tokenHash, accountId, expiresAt.toISOString());
}

export function getRefreshTokenByHash(tokenHash: string): RefreshTokenRow | undefined {
  return db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?").get(tokenHash) as unknown as
    | RefreshTokenRow
    | undefined;
}

export function revokeRefreshToken(tokenHash: string): void {
  db.prepare("UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE token_hash = ?").run(
    tokenHash
  );
}

export function revokeAllRefreshTokensForAccount(accountId: number): void {
  db.prepare(
    "UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE account_id = ? AND revoked_at IS NULL"
  ).run(accountId);
}
