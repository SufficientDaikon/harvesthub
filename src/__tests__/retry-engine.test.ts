import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../core/retry-engine.js";

describe("Retry Engine", () => {
  it("returns success on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("data");
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toBe("data");
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient errors and succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error("Transient ECONNRESET");
      return "ok";
    });

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 1,
      jitter: false,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe("ok");
    expect(result.attempts).toBe(3);
  });

  it("fails after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Always fails"));
    const result = await withRetry(fn, {
      maxRetries: 2,
      baseDelay: 1,
      jitter: false,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3); // 1 initial + 2 retries
    expect(result.errors).toHaveLength(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry permanent errors", async () => {
    // A 404 URL error should be classified as permanent
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Not found"), { httpStatus: 404 }),
      );

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 1,
      jitter: false,
    });

    expect(result.success).toBe(false);
    // Permanent errors stop immediately — only 1 attempt
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("returns errors array with all attempt errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("err1"))
      .mockRejectedValueOnce(new Error("err2"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 1,
      jitter: false,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]!.message).toBe("err1");
    expect(result.errors[1]!.message).toBe("err2");
  });
});
