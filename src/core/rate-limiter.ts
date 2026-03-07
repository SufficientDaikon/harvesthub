import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("rate-limiter");

interface DomainBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  lastRefill: number;
}

const buckets = new Map<string, DomainBucket>();

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

export function configureDomain(
  domain: string,
  requestsPerSecond: number,
  burst = 3,
): void {
  buckets.set(domain, {
    tokens: burst,
    maxTokens: burst,
    refillRate: requestsPerSecond,
    lastRefill: Date.now(),
  });
}

function getOrCreateBucket(domain: string): DomainBucket {
  let bucket = buckets.get(domain);
  if (!bucket) {
    bucket = { tokens: 1, maxTokens: 3, refillRate: 1, lastRefill: Date.now() };
    buckets.set(domain, bucket);
  }
  return bucket;
}

function refill(bucket: DomainBucket): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    bucket.maxTokens,
    bucket.tokens + elapsed * bucket.refillRate,
  );
  bucket.lastRefill = now;
}

export async function acquireToken(url: string): Promise<void> {
  const domain = getDomain(url);
  const bucket = getOrCreateBucket(domain);

  refill(bucket);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return;
  }

  const waitMs = Math.ceil(((1 - bucket.tokens) / bucket.refillRate) * 1000);
  log.debug({ domain, waitMs }, "Rate limited — waiting");
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  refill(bucket);
  bucket.tokens -= 1;
}

export function resetRateLimits(): void {
  buckets.clear();
}
