import { WebSocket } from "ws";
import { allConnections } from "./wsServer";
import type { FanoutMessage } from "../types";

export function broadcast(message: FanoutMessage): void {
  const payload = JSON.stringify(message);
  for (const ws of allConnections()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}
