import type { NextFunction, Request, Response } from "express";
import { logger } from "../logging/logger";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  logger.error({ err, path: req.path }, "Unhandled request error");
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "internal_error" });
}
