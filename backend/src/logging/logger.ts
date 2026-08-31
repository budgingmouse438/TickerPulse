import pino from "pino";

// Never log secrets: API keys, JWT signing material, cookies, passwords, tokens.
// pino's redact walks these paths (and one level of wildcard) and replaces values with "[Redacted]".
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "*.password",
      "*.password_hash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.apiKeyId",
      "*.apiSecretKey",
      "*.jwtSigningSecret",
    ],
    censor: "[Redacted]",
  },
});
