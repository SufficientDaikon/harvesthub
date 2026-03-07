import { describe, it, expect } from "vitest";
import {
  normalizePrice,
  normalizeAvailability,
  sanitizeText,
  resolveUrl,
} from "../pipeline/normalizer.js";

describe("Price Normalizer", () => {
  it("parses US format price", () => {
    const result = normalizePrice("$1,234.56");
    expect(result).toEqual({ price: 1234.56, currency: "USD" });
  });

  it("parses EU format price", () => {
    const result = normalizePrice("1.234,56€");
    expect(result).toEqual({ price: 1234.56, currency: "EUR" });
  });

  it("parses SAR price", () => {
    const result = normalizePrice("2700.00 SAR");
    expect(result).toEqual({ price: 2700, currency: "SAR" });
  });

  it("parses plain number", () => {
    const result = normalizePrice(99.99);
    expect(result).toEqual({ price: 99.99, currency: "" });
  });

  it("returns null for empty input", () => {
    expect(normalizePrice(null)).toBeNull();
    expect(normalizePrice("")).toBeNull();
    expect(normalizePrice(undefined)).toBeNull();
  });

  it("handles GBP symbol", () => {
    const result = normalizePrice("£49.99");
    expect(result).toEqual({ price: 49.99, currency: "GBP" });
  });
});

describe("Availability Normalizer", () => {
  it('normalizes "in stock" variants', () => {
    expect(normalizeAvailability("in_stock")).toBe("in_stock");
    expect(normalizeAvailability("InStock")).toBe("in_stock");
    expect(normalizeAvailability("https://schema.org/InStock")).toBe(
      "in_stock",
    );
    expect(normalizeAvailability("Available")).toBe("in_stock");
  });

  it('normalizes "out of stock" variants', () => {
    expect(normalizeAvailability("out_of_stock")).toBe("out_of_stock");
    expect(normalizeAvailability("OutOfStock")).toBe("out_of_stock");
    expect(normalizeAvailability("Sold Out")).toBe("out_of_stock");
  });

  it("returns unknown for garbage", () => {
    expect(normalizeAvailability("")).toBe("unknown");
    expect(normalizeAvailability(null)).toBe("unknown");
    expect(normalizeAvailability("banana")).toBe("unknown");
  });
});

describe("Text Sanitizer", () => {
  it("strips HTML tags", () => {
    expect(sanitizeText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("collapses whitespace", () => {
    expect(sanitizeText("hello   world\n\ntest")).toBe("hello world test");
  });

  it("returns null for empty input", () => {
    expect(sanitizeText(null)).toBeNull();
    expect(sanitizeText("")).toBeNull();
  });

  it("truncates very long strings", () => {
    const long = "a".repeat(20000);
    const result = sanitizeText(long);
    expect(result!.length).toBe(10000);
  });
});

describe("URL Resolver", () => {
  it("resolves relative URLs", () => {
    expect(
      resolveUrl("/images/photo.jpg", "https://example.com/product/1"),
    ).toBe("https://example.com/images/photo.jpg");
  });

  it("passes through absolute URLs", () => {
    expect(
      resolveUrl("https://cdn.example.com/img.png", "https://example.com"),
    ).toBe("https://cdn.example.com/img.png");
  });

  it("returns null for empty input", () => {
    expect(resolveUrl(null, "https://example.com")).toBeNull();
    expect(resolveUrl("", "https://example.com")).toBeNull();
  });
});
