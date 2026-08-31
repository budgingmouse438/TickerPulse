export interface Tick {
  type: "tick";
  symbol: string;
  price: number;
  ts: string;
}

export interface Snapshot {
  type: "snapshot";
  symbol: string;
  price: number;
  ts: string;
}

export interface Degraded {
  type: "degraded";
  source: "alpaca";
  message: string;
}

export type FanoutMessage = Tick | Snapshot | Degraded;

export interface AccountRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface RefreshTokenRow {
  id: number;
  token_hash: string;
  account_id: number;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface WatchlistRow {
  symbol: string;
  added_at: string;
}
