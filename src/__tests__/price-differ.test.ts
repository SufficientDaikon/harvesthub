import { describe, it, expect } from "vitest";
import { diffAndMerge, getPriceTrend } from "../core/price-differ.js";
import type { Product } from "../types/index.js";

function makeProduct(price: number, id = "p1"): Product {
  return {
    id,
    sourceUrl: "https://example.com/product/1",
    scrapedAt: "2026-01-01T00:00:00.000Z",
    title: "Test Product",
    price,
    currency: "USD",
    description: null,
    images: [],
    availability: "in_stock",
    brand: null,
    sku: null,
    mpn: null,
    gtin: null,
    category: null,
    rating: null,
    reviewCount: null,
    specifications: {},
    seller: null,
    shipping: null,
    alternativePrices: [],
    confidenceScores: {},
    overallConfidence: 80,
    extractionMethod: "adaptive",
    metadata: {},
  };
}

describe("Price Differ", () => {
  it("returns no change when price is identical", () => {
    const existing = makeProduct(99.99);
    const incoming = makeProduct(99.99);
    const { change, merged } = diffAndMerge(existing, incoming);

    expect(change).toBeNull();
    expect(merged.price).toBe(99.99);
    expect(merged.priceHistory).toHaveLength(0);
  });

  it("detects price increase and records history", () => {
    const existing = makeProduct(50.0);
    const incoming = makeProduct(75.0);
    const { change, merged } = diffAndMerge(existing, incoming);

    expect(change).not.toBeNull();
    expect(change!.oldPrice).toBe(50.0);
    expect(change!.newPrice).toBe(75.0);
    expect(change!.delta).toBe(25.0);
    expect(change!.pctChange).toBe(50);

    expect(merged.price).toBe(75.0);
    expect(merged.priceHistory).toHaveLength(1);
    expect(merged.priceHistory![0]!.price).toBe(50.0);
  });

  it("detects price decrease", () => {
    const existing = makeProduct(100.0);
    const incoming = makeProduct(80.0);
    const { change } = diffAndMerge(existing, incoming);

    expect(change).not.toBeNull();
    expect(change!.delta).toBe(-20.0);
    expect(change!.pctChange).toBe(-20);
  });

  it("preserves existing price history on further changes", () => {
    const existing: Product = {
      ...makeProduct(50.0),
      priceHistory: [
        {
          price: 40.0,
          currency: "USD",
          recordedAt: "2025-12-01T00:00:00.000Z",
        },
      ],
    };
    const incoming = makeProduct(60.0);
    const { merged } = diffAndMerge(existing, incoming);

    // Should have 2 history entries: the old one + the current existing price
    expect(merged.priceHistory).toHaveLength(2);
    expect(merged.priceHistory![0]!.price).toBe(40.0);
    expect(merged.priceHistory![1]!.price).toBe(50.0);
    expect(merged.price).toBe(60.0);
  });

  it("does not record change when existing price is 0", () => {
    const existing = makeProduct(0);
    const incoming = makeProduct(99.99);
    const { change } = diffAndMerge(existing, incoming);

    expect(change).toBeNull();
  });
});

describe("Price Trend", () => {
  it("returns unknown when no history", () => {
    const p = makeProduct(50.0);
    expect(getPriceTrend(p)).toBe("unknown");
  });

  it("returns up when current price is higher than last history", () => {
    const p: Product = {
      ...makeProduct(80.0),
      priceHistory: [
        {
          price: 60.0,
          currency: "USD",
          recordedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    expect(getPriceTrend(p)).toBe("up");
  });

  it("returns down when current price is lower than last history", () => {
    const p: Product = {
      ...makeProduct(40.0),
      priceHistory: [
        {
          price: 60.0,
          currency: "USD",
          recordedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    expect(getPriceTrend(p)).toBe("down");
  });

  it("returns stable when prices are equal", () => {
    const p: Product = {
      ...makeProduct(60.0),
      priceHistory: [
        {
          price: 60.0,
          currency: "USD",
          recordedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    expect(getPriceTrend(p)).toBe("stable");
  });
});
