import { WebSocket } from "ws";
import { env } from "../config/env";
import { logger } from "../logging/logger";
import { broadcast } from "../fanout/broadcast";
import type { Tick } from "../types";

const STREAM_URL = `wss://stream.data.alpaca.markets/v2/${env.alpacaDataFeed}`;

type AlpacaStreamMessage =
  | { T: "success" | "error"; msg: string; code?: number }
  | { T: "subscription"; trades?: string[]; quotes?: string[] }
  | { T: "t"; S: string; p: number; t: string };

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

class AlpacaWsManager {
  private ws: WebSocket | null = null;
  private authenticated = false;
  private desiredSymbols = new Set<string>();
  private reconnectAttempt = 0;

  connect(): void {
    logger.info({ url: STREAM_URL }, "Connecting to Alpaca market data stream");
    const ws = new WebSocket(STREAM_URL);
    this.ws = ws;

    ws.on("open", () => {
      logger.info("Alpaca stream connected, authenticating");
      ws.send(
        JSON.stringify({
          action: "auth",
          key: env.alpacaApiKeyId,
          secret: env.alpacaApiSecretKey,
        })
      );
    });

    ws.on("message", (raw) => this.handleMessage(raw.toString()));

    ws.on("close", (code) => {
      this.authenticated = false;
      logger.warn({ code }, "Alpaca stream disconnected, reconnecting with backoff");
      this.scheduleReconnect();
    });

    ws.on("error", (err) => {
      logger.warn({ err }, "Alpaca stream error");
    });
  }

  private scheduleReconnect(): void {
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** this.reconnectAttempt);
    const jittered = Math.random() * delay;
    this.reconnectAttempt += 1;
    setTimeout(() => this.connect(), jittered);
  }

  private handleMessage(raw: string): void {
    let messages: AlpacaStreamMessage[];
    try {
      messages = JSON.parse(raw);
    } catch {
      logger.warn("Received non-JSON message from Alpaca stream");
      return;
    }

    for (const msg of messages) {
      if (msg.T === "success" && msg.msg === "authenticated") {
        this.authenticated = true;
        this.reconnectAttempt = 0;
        logger.info("Alpaca stream authenticated, re-subscribing active symbols");
        this.resubscribeAll();
      } else if (msg.T === "error") {
        logger.warn({ code: msg.code, alpacaMessage: msg.msg }, "Alpaca stream error message");
      } else if (msg.T === "t") {
        const tick: Tick = { type: "tick", symbol: msg.S, price: msg.p, ts: msg.t };
        broadcast(tick);
      }
    }
  }

  private resubscribeAll(): void {
    if (this.desiredSymbols.size === 0) return;
    this.send({ action: "subscribe", trades: Array.from(this.desiredSymbols) });
  }

  private send(payload: unknown): void {
    if (this.ws && this.authenticated) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  subscribe(symbol: string): void {
    if (this.desiredSymbols.has(symbol)) return;
    this.desiredSymbols.add(symbol);
    this.send({ action: "subscribe", trades: [symbol] });
  }

  unsubscribe(symbol: string): void {
    if (!this.desiredSymbols.has(symbol)) return;
    this.desiredSymbols.delete(symbol);
    this.send({ action: "unsubscribe", trades: [symbol] });
  }
}

export const alpacaWsManager = new AlpacaWsManager();
