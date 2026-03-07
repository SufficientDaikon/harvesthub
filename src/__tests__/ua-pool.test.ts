import { describe, it, expect } from "vitest";
import {
  getNextUserAgent,
  getRandomUserAgent,
  getUserAgentCount,
} from "../core/ua-pool.js";

describe("User Agent Pool", () => {
  it("has at least 15 user agents", () => {
    expect(getUserAgentCount()).toBeGreaterThanOrEqual(15);
  });

  it("returns valid UA strings", () => {
    const ua = getNextUserAgent();
    expect(ua).toContain("Mozilla");
    expect(ua.length).toBeGreaterThan(50);
  });

  it("rotates through agents sequentially", () => {
    const first = getNextUserAgent();
    const second = getNextUserAgent();
    expect(first).not.toBe(second);
  });

  it("getRandomUserAgent returns a valid string", () => {
    const ua = getRandomUserAgent();
    expect(ua).toContain("Mozilla");
  });
});
