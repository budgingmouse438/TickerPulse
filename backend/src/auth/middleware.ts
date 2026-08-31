import type { NextFunction, Request, Response } from "express";
import { verifySessionFromCookieHeader } from "./session";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      accountId?: number;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const payload = verifySessionFromCookieHeader(req.headers.cookie);
  if (!payload) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  req.accountId = payload.accountId;
  next();
}

/**
 * Defense-in-depth CSRF mitigation for cookie-authenticated, same-origin
 * mutating requests. SameSite=Strict on our cookies already blocks the
 * browser from attaching them to cross-site requests, which defeats the
 * classic CSRF attack outright. This adds a second, independent check: a
 * plain HTML form (the only thing a CSRF attacker can submit without
 * running JS on our origin) cannot set a custom header or a real
 * application/json content type, so requiring one here closes the gap for
 * any browser/edge case where SameSite alone might not hold.
 */
export function csrfHeaderCheck(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers["content-type"] ?? "";
  const requestedWith = req.headers["x-requested-with"];
  if (requestedWith === "TickerPulse" || contentType.includes("application/json")) {
    next();
    return;
  }
  res.status(403).json({ error: "csrf_check_failed" });
}
