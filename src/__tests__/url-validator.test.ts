import { describe, it, expect } from "vitest";
import {
  validateUrl,
  validateAndDeduplicateUrls,
} from "../lib/url-validator.js";

describe("URL Validator", () => {
  it("accepts valid HTTP URLs", () => {
    const result = validateUrl("https://example.com/product/123");
    expect(result.ok).toBe(true);
  });

  it("accepts valid HTTP URL with query params", () => {
    const result = validateUrl(
      "https://store.example.com/item?id=456&ref=home",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects empty string", () => {
    const result = validateUrl("");
    expect(result.ok).toBe(false);
  });

  it("rejects non-http schemes", () => {
    const result = validateUrl("ftp://files.example.com/data");
    expect(result.ok).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const result = validateUrl("not a url at all");
    expect(result.ok).toBe(false);
  });

  it("rejects URLs without TLD", () => {
    const result = validateUrl("https://localhost/path");
    expect(result.ok).toBe(false);
  });

  it("deduplicates identical URLs", () => {
    const result = validateAndDeduplicateUrls([
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/a",
    ]);
    expect(result.valid).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("separates valid and invalid URLs", () => {
    const result = validateAndDeduplicateUrls([
      "https://example.com/good",
      "not-a-url",
      "https://store.com/also-good",
      "",
    ]);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(2);
  });
});
