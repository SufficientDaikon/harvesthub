import { classifyError, type HarvestError } from "../lib/errors.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("retry-engine");

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  multiplier: number;
  maxDelay: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 2000,
  multiplier: 2,
  maxDelay: 60000,
  jitter: true,
};

function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay = config.baseDelay * Math.pow(config.multiplier, attempt);
  delay = Math.min(delay, config.maxDelay);
  if (config.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }
  return Math.round(delay);
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  attempts: number;
  errors: Error[];
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<RetryResult<T>> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  const errors: Error[] = [];

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const data = await fn();
      return { success: true, data, attempts: attempt + 1, errors };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error);

      const category = classifyError(error);
      log.warn({ attempt, category, msg: error.message }, "Attempt failed");

      if (category === "permanent") {
        log.info("Permanent error — not retrying");
        return { success: false, attempts: attempt + 1, errors };
      }

      if (attempt < cfg.maxRetries) {
        const delay = calculateDelay(attempt, cfg);
        log.info({ delay, nextAttempt: attempt + 1 }, "Retrying after delay");
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, attempts: cfg.maxRetries + 1, errors };
}
