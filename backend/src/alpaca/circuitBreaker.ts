import { logger } from "../logging/logger";

type State = "closed" | "open" | "half-open";

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 30_000;

/**
 * Shared circuit breaker for outbound Alpaca calls. Prevents tight-looping
 * against a failing/rate-limited Alpaca API — once open, calls fail fast
 * (surfaced to clients as a "degraded" fanout message) instead of hammering
 * Alpaca further, with a half-open probe to detect recovery.
 */
class CircuitBreaker {
  private state: State = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;

  isOpen(): boolean {
    if (this.state === "open" && Date.now() - this.openedAt >= COOLDOWN_MS) {
      this.state = "half-open";
    }
    return this.state === "open";
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state !== "closed") {
      logger.info("Alpaca circuit breaker closing after successful call");
    }
    this.state = "closed";
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.state === "half-open" || this.consecutiveFailures >= FAILURE_THRESHOLD) {
      if (this.state !== "open") {
        logger.warn({ consecutiveFailures: this.consecutiveFailures }, "Alpaca circuit breaker opening");
      }
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}

export const alpacaCircuitBreaker = new CircuitBreaker();
