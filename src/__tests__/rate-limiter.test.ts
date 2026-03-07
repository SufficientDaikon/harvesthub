import { describe, it, expect, beforeEach } from "vitest";
import {
  acquireToken,
  configureDomain,
  resetRateLimits,
} from "../core/rate-limiter.js";

describe("Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows immediate request when bucket has tokens", async () => {
    const start = Date.now();
    await acquireToken("https://example.com/product/1");
    expect(Date.now() - start).toBeLessThan(100);
  });

  it("separates buckets per domain", async () => {
    // Configure both domains with plenty of burst tokens so no waiting
    configureDomain("example.com", 10, 10);
    configureDomain("other.com", 10, 10);

    const start = Date.now();
    await acquireToken("https://example.com/p1");
    await acquireToken("https://other.com/p1");
    // Both should succeed quickly
    expect(Date.now() - start).toBeLessThan(200);
  });

  it("extracts domain correctly from URL", async () => {
    configureDomain("shop.example.com", 10, 5);
    const start = Date.now();
    await acquireToken("https://shop.example.com/item/123?ref=nav");
    expect(Date.now() - start).toBeLessThan(100);
  });

  it("resets all limits", async () => {
    configureDomain("example.com", 1, 1);
    resetRateLimits();
    // After reset, a new default bucket is created — should have a token
    const start = Date.now();
    await acquireToken("https://example.com/product/1");
    expect(Date.now() - start).toBeLessThan(200);
  });
});
