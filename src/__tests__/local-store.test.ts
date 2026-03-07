import { describe, it, expect } from "vitest";
import {
  loadProducts,
  saveProducts,
  clearStore,
  getProductCount,
} from "../store/local-store.js";
import type { Product } from "../types/index.js";

const TEST_STORE = "test-store";

function makeProduct(id: string): Product {
  return {
    id,
    sourceUrl: `https://example.com/product/${id}`,
    scrapedAt: new Date().toISOString(),
    title: `Test Product ${id}`,
    price: 99.99,
    currency: "USD",
    description: "A test product",
    images: ["https://example.com/img.jpg"],
    availability: "in_stock",
    brand: "TestBrand",
    sku: id,
    mpn: null,
    gtin: null,
    category: "Test",
    rating: 4.5,
    reviewCount: 100,
    specifications: { color: "red" },
    seller: null,
    shipping: null,
    alternativePrices: [],
    confidenceScores: { title: 95, price: 90 },
    overallConfidence: 92,
    extractionMethod: "adaptive",
    metadata: {},
  };
}

describe("Local Store", () => {
  it("starts empty", async () => {
    await clearStore(TEST_STORE);
    const products = await loadProducts(TEST_STORE);
    expect(products).toHaveLength(0);
  });

  it("saves and loads products", async () => {
    await clearStore(TEST_STORE);
    const products = [makeProduct("p1"), makeProduct("p2")];
    await saveProducts(products, TEST_STORE);

    const loaded = await loadProducts(TEST_STORE);
    expect(loaded).toHaveLength(2);
    expect(loaded[0]!.title).toBe("Test Product p1");
  });

  it("deduplicates by ID on save", async () => {
    await clearStore(TEST_STORE);
    await saveProducts([makeProduct("p1")], TEST_STORE);
    await saveProducts(
      [{ ...makeProduct("p1"), title: "Updated" }],
      TEST_STORE,
    );

    const loaded = await loadProducts(TEST_STORE);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.title).toBe("Updated");
  });

  it("counts products correctly", async () => {
    await clearStore(TEST_STORE);
    await saveProducts(
      [makeProduct("c1"), makeProduct("c2"), makeProduct("c3")],
      TEST_STORE,
    );
    const count = await getProductCount(TEST_STORE);
    expect(count).toBe(3);
  });

  it("clears store", async () => {
    await saveProducts([makeProduct("x1")], TEST_STORE);
    await clearStore(TEST_STORE);
    const count = await getProductCount(TEST_STORE);
    expect(count).toBe(0);
  });
});
