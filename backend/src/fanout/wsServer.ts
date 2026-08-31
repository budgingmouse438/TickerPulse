import { WebSocket, WebSocketServer } from "ws";
import { logger } from "../logging/logger";

interface TrackedSocket extends WebSocket {
  isAlive?: boolean;
  accountId?: number;
}

export const wss = new WebSocketServer({ noServer: true });

// Connections grouped by account so logout can proactively close them.
// Single-user today, but scoped by accountId so this doesn't need to change
// if multi-user is ever added later.
const connectionsByAccount = new Map<number, Set<TrackedSocket>>();

export function registerConnection(accountId: number, ws: TrackedSocket): void {
  ws.accountId = accountId;
  ws.isAlive = true;
  let set = connectionsByAccount.get(accountId);
  if (!set) {
    set = new Set();
    connectionsByAccount.set(accountId, set);
  }
  set.add(ws);

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("close", () => {
    connectionsByAccount.get(accountId)?.delete(ws);
  });
}

export function closeConnectionsForAccount(accountId: number, code: number, reason: string): void {
  const set = connectionsByAccount.get(accountId);
  if (!set) return;
  for (const ws of set) {
    ws.close(code, reason);
  }
  connectionsByAccount.delete(accountId);
}

export function allConnections(): TrackedSocket[] {
  return Array.from(connectionsByAccount.values()).flatMap((set) => Array.from(set));
}

const HEARTBEAT_INTERVAL_MS = 30_000;

// Prune dead connections (client vanished without a clean close, e.g. laptop
// sleep/network drop) so we don't leak sockets/memory over time.
setInterval(() => {
  for (const ws of allConnections()) {
    if (ws.isAlive === false) {
      logger.info({ accountId: ws.accountId }, "Terminating unresponsive fanout connection");
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL_MS).unref();

wss.on("connection", (ws: TrackedSocket, req) => {
  const accountId = (req as { accountId?: number }).accountId;
  if (accountId === undefined) {
    ws.close(4000, "missing account context");
    return;
  }
  registerConnection(accountId, ws);
  logger.info({ accountId }, "Fanout client connected");
});
