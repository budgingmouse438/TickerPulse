import cors from "cors";
import helmet from "helmet";
import { env } from "../config/env";

export const securityHeaders = helmet({
  hsts: {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
  },
  // CSP is intentionally left at helmet's conservative default until a
  // frontend build exists — script-src/connect-src need to match its origin
  // and build tool before being tightened further.
});

export const corsMiddleware = cors({
  origin: env.frontendOrigin,
  credentials: true,
});
