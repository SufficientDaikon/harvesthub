/**
 * Tests for batch API logic — validates URL handling and batch job types.
 */
import { describe, it, expect } from "vitest";
import {
  validateAndDeduplicateUrls,
  validateUrl,
} from "../lib/url-validator.js";
import { parseUrlString } from "../lib/url-parser.js";

describe("Batch URL Processing", () => {
  describe("validateAndDeduplicateUrls", () => {
    it("should validate and deduplicate URLs", () => {
      const result = validateAndDeduplicateUrls([
        "https://example.com/product-1",
        "https://example.com/product-2",
        "https://example.com/product-1", // duplicate
        "not-a-url",
        "https://example.com/product-3",
      ]);

      expect(result.valid).toHaveLength(3);
      expect(result.invalid).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(1);
      expect(result.invalid[0]?.reason).toBe(
        "Malformed URL — could not parse",
      );
    });

    it("should return empty valid array for all invalid URLs", () => {
      const result = validateAndDeduplicateUrls([
        "not-a-url",
        "also-not-valid",
        "ftp://wrong-scheme.com",
      ]);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(3);
    });

    it("should handle empty array", () => {
      const result = validateAndDeduplicateUrls([]);
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
      expect(result.duplicatesRemoved).toBe(0);
    });
  });

  describe("parseUrlString", () => {
    it("should parse newline-separated URLs", () => {
      const input =
        "https://example.com/a\nhttps://example.com/b\nhttps://example.com/c";
      const result = parseUrlString(input);
      expect(result.valid).toHaveLength(3);
    });

    it("should strip comment lines", () => {
      const input =
        "# This is a comment\nhttps://example.com/a\n# Another comment\nhttps://example.com/b";
      const result = parseUrlString(input);
      expect(result.valid).toHaveLength(2);
    });

    it("should handle Windows line endings", () => {
      const input =
        "https://example.com/a\r\nhttps://example.com/b\r\nhttps://example.com/c";
      const result = parseUrlString(input);
      expect(result.valid).toHaveLength(3);
    });

    it("should skip empty lines", () => {
      const input =
        "https://example.com/a\n\n\nhttps://example.com/b\n\nhttps://example.com/c";
      const result = parseUrlString(input);
      expect(result.valid).toHaveLength(3);
    });
  });

  describe("validateUrl", () => {
    it("should accept valid HTTP URLs", () => {
      expect(validateUrl("https://example.com/product")).toEqual({
        ok: true,
        url: "https://example.com/product",
      });
    });

    it("should reject non-HTTP schemes", () => {
      const result = validateUrl("ftp://example.com");
      expect(result.ok).toBe(false);
    });

    it("should reject empty strings", () => {
      const result = validateUrl("");
      expect(result.ok).toBe(false);
    });

    it("should reject malformed URLs", () => {
      const result = validateUrl("not a url at all");
      expect(result.ok).toBe(false);
    });
  });
});
