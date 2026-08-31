import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { verifySessionFromCookieHeader } from "../auth/session";
import { wss } from "./wsServer";
import { logger } from "../logging/logger";

/**
 * Validates the session cookie BEFORE completing the WebSocket handshake.
 * An invalid/missing/expired session gets a raw 401 written directly to the
 * socket and the connection is destroyed — we never accept the upgrade and
 * close afterward, since that would briefly hand an unauthenticated client a
 * live socket.
 */
export function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  const payload = verifySessionFromCookieHeader(req.headers.cookie);
  if (!payload) {
    logger.warn({ url: req.url }, "Rejected unauthenticated WebSocket upgrade");
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  (req as IncomingMessage & { accountId?: number }).accountId = payload.accountId;

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
}
