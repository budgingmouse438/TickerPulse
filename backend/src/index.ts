import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./logging/logger";
import { runMigrations } from "./db/migrate";
import { securityHeaders, corsMiddleware } from "./middleware/security";
import { globalRateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./auth/routes";
import { watchlistRouter } from "./watchlist/routes";
import { handleUpgrade } from "./fanout/upgradeHandler";
import { alpacaWsManager } from "./alpaca/wsManager";
import { activeSet } from "./alpaca/activeSet";
import { startRestPoller } from "./alpaca/restPoller";

runMigrations();

const app = express();
if (env.trustProxy) {
  app.set("trust proxy", 1);
}

app.use(pinoHttp({ logger }));
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: "16kb" }));
app.use(globalRateLimit);

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api", watchlistRouter);

app.use(errorHandler);

const server = http.createServer(app);
server.on("upgrade", (req, socket, head) => {
  handleUpgrade(req, socket, head);
});

alpacaWsManager.connect();
activeSet.startIdleSweep();
startRestPoller();

server.listen(env.port, () => {
  logger.info({ port: env.port }, "TickerPulse backend listening");
});
