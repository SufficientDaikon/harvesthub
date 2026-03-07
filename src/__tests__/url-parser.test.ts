import { describe, it, expect } from "vitest";
import { parseUrlString } from "../lib/url-parser.js";

describe("URL Parser (string input)", () => {
  it("parses comma-separated URLs", () => {
    const result = parseUrlString(
      "https://example.com/p1,https://example.com/p2",
    );
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it("parses newline-separated URLs", () => {
    const result = parseUrlString(
      "https://example.com/p1\nhttps://example.com/p2\nhttps://example.com/p3",
    );
    expect(result.valid).toHaveLength(3);
  });

  it("filters out invalid URLs", () => {
    const result = parseUrlString(
      "https://example.com/p1,not-a-url,ftp://bad.com",
    );
    expect(result.valid).toHaveLength(1);
    expect(result.invalid.length).toBeGreaterThanOrEqual(1);
  });

  it("deduplicates URLs", () => {
    const result = parseUrlString(
      "https://example.com/p1,https://example.com/p1,https://example.com/p2",
    );
    expect(result.valid).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("ignores comment lines", () => {
    const result = parseUrlString(
      "# this is a comment\nhttps://example.com/p1",
    );
    expect(result.valid).toHaveLength(1);
  });

  it("returns empty result for empty input", () => {
    const result = parseUrlString("");
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });

  it("handles semicolon separators", () => {
    const result = parseUrlString(
      "https://example.com/p1;https://example.com/p2",
    );
    expect(result.valid).toHaveLength(2);
  });
});
