import { describe, it, expect } from "vitest";
import {
  classifyError,
  classifyHttpStatus,
  TransientError,
  PermanentError,
  BlockedError,
} from "../lib/errors.js";

describe("Error Classification", () => {
  it("classifies TransientError correctly", () => {
    const err = new TransientError("timeout", "TIMEOUT");
    expect(classifyError(err)).toBe("transient");
  });

  it("classifies PermanentError correctly", () => {
    const err = new PermanentError("not found", "NOT_FOUND", 404);
    expect(classifyError(err)).toBe("permanent");
  });

  it("classifies BlockedError correctly", () => {
    const err = new BlockedError("captcha required", "CAPTCHA");
    expect(classifyError(err)).toBe("blocked");
  });

  it("classifies generic 404 error as permanent", () => {
    expect(classifyError(new Error("404 not found"))).toBe("permanent");
  });

  it("classifies generic 403 error as blocked", () => {
    expect(classifyError(new Error("403 forbidden"))).toBe("blocked");
  });

  it("classifies Cloudflare error as blocked", () => {
    expect(classifyError(new Error("cloudflare challenge detected"))).toBe(
      "blocked",
    );
  });

  it("classifies unknown error as transient", () => {
    expect(classifyError(new Error("something weird happened"))).toBe(
      "transient",
    );
  });

  it("classifies non-Error as transient", () => {
    expect(classifyError("string error")).toBe("transient");
  });
});

describe("HTTP Status Classification", () => {
  it("classifies 404 as permanent", () => {
    expect(classifyHttpStatus(404)).toBe("permanent");
  });

  it("classifies 410 as permanent", () => {
    expect(classifyHttpStatus(410)).toBe("permanent");
  });

  it("classifies 403 as blocked", () => {
    expect(classifyHttpStatus(403)).toBe("blocked");
  });

  it("classifies 429 as blocked", () => {
    expect(classifyHttpStatus(429)).toBe("blocked");
  });

  it("classifies 500 as transient", () => {
    expect(classifyHttpStatus(500)).toBe("transient");
  });

  it("classifies 502 as transient", () => {
    expect(classifyHttpStatus(502)).toBe("transient");
  });

  it("classifies 504 as transient", () => {
    expect(classifyHttpStatus(504)).toBe("transient");
  });
});
