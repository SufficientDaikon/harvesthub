import { describe, it, expect, beforeEach } from "vitest";
import {
  addProxies,
  getNextProxy,
  getProxyCount,
  clearProxies,
} from "../core/proxy-pool.js";

describe("Proxy Pool", () => {
  beforeEach(() => {
    clearProxies();
  });

  it("returns null when no proxies configured", () => {
    expect(getNextProxy()).toBeNull();
  });

  it("returns proxy count", () => {
    addProxies([
      "http://proxy1.example.com:8080",
      "http://proxy2.example.com:8080",
    ]);
    expect(getProxyCount()).toBe(2);
  });

  it("rotates proxies round-robin", () => {
    addProxies([
      "http://p1.example.com:8080",
      "http://p2.example.com:8080",
      "http://p3.example.com:8080",
    ]);

    expect(getNextProxy()).toBe("http://p1.example.com:8080");
    expect(getNextProxy()).toBe("http://p2.example.com:8080");
    expect(getNextProxy()).toBe("http://p3.example.com:8080");
    // Wraps around
    expect(getNextProxy()).toBe("http://p1.example.com:8080");
  });

  it("deduplicates proxies on add", () => {
    addProxies(["http://p1.example.com:8080"]);
    addProxies(["http://p1.example.com:8080"]);
    expect(getProxyCount()).toBe(1);
  });

  it("clears all proxies", () => {
    addProxies(["http://p1.example.com:8080"]);
    clearProxies();
    expect(getProxyCount()).toBe(0);
    expect(getNextProxy()).toBeNull();
  });
});
