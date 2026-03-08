/**
 * Integration tests for the export pipeline.
 * Tests all 4 export formats end-to-end with real file I/O.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { exportProducts, SUPPORTED_FORMATS } from "../export/index.js";
import type { Product } from "../types/product.js";

const TEST_EXPORT_DIR = resolve(
  process.cwd(),
  "data",
  "exports",
  "test-integration",
);

function makeProduct(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    sourceUrl: `https://example.com/product/${id}`,
    scrapedAt: new Date().toISOString(),
    title: `Test Product ${id}`,
    price: 29.99,
    currency: "USD",
    description: `Description for product ${id}`,
    images: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
    availability: "in_stock",
    brand: "TestBrand",
    sku: `SKU-${id}`,
    mpn: `MPN-${id}`,
    gtin: `GTIN-${id}`,
    category: "Electronics",
    rating: 4.5,
    reviewCount: 42,
    specifications: { color: "Red", size: "Medium" },
    seller: "TestSeller",
    shipping: "Free",
    alternativePrices: [{ price: 27.99, currency: "USD" }],
    confidenceScores: { title: 95, price: 90, description: 80 },
    overallConfidence: 85,
    extractionMethod: "adaptive",
    metadata: { source: "test" },
    ...overrides,
  };
}

const testProducts: Product[] = [
  makeProduct("exp-1", { title: "Widget Alpha", price: 10.0, brand: "Acme" }),
  makeProduct("exp-2", {
    title: "Gadget Beta",
    price: 25.5,
    brand: "Zeta",
    availability: "out_of_stock",
  }),
  makeProduct("exp-3", {
    title: "Gizmo Gamma",
    price: 99.99,
    brand: "Acme",
    category: "Gizmos",
  }),
];

describe("Export Pipeline Integration", () => {
  beforeAll(async () => {
    await mkdir(TEST_EXPORT_DIR, { recursive: true });
  });

  afterAll(async () => {
    if (existsSync(TEST_EXPORT_DIR)) {
      await rm(TEST_EXPORT_DIR, { recursive: true, force: true });
    }
  });

  it("exports CSV with correct structure", async () => {
    const outPath = resolve(TEST_EXPORT_DIR, "test.csv");
    const result = await exportProducts(testProducts, outPath, "csv");

    expect(existsSync(result)).toBe(true);
    const content = await readFile(result, "utf-8");

    // Check BOM
    expect(content.charCodeAt(0)).toBe(0xfeff);

    // Check header row
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(4); // header + 3 products

    // Check that product titles are in the CSV
    expect(content).toContain("Widget Alpha");
    expect(content).toContain("Gadget Beta");
    expect(content).toContain("Gizmo Gamma");
  });

  it("exports JSON with metadata and products array", async () => {
    const outPath = resolve(TEST_EXPORT_DIR, "test.json");
    const result = await exportProducts(testProducts, outPath, "json");

    expect(existsSync(result)).toBe(true);
    const content = await readFile(result, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed.meta).toBeTruthy();
    expect(parsed.meta.totalProducts).toBe(3);
    expect(parsed.products).toBeInstanceOf(Array);
    expect(parsed.products).toHaveLength(3);
    expect(parsed.products[0].title).toBe("Widget Alpha");
  });

  it("exports XLSX as valid file", async () => {
    const outPath = resolve(TEST_EXPORT_DIR, "test.xlsx");
    const result = await exportProducts(testProducts, outPath, "xlsx");

    expect(existsSync(result)).toBe(true);
    // XLSX files start with PK (ZIP signature)
    const buf = await readFile(result);
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
    expect(buf.length).toBeGreaterThan(1000); // Non-trivial file
  });

  it("exports GMC TSV feed", async () => {
    const outPath = resolve(TEST_EXPORT_DIR, "test.tsv");
    const result = await exportProducts(testProducts, outPath, "gmc");

    expect(existsSync(result)).toBe(true);
    const content = await readFile(result, "utf-8");

    // GMC feed should be tab-separated
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(4); // header + 3 products

    // Check header has GMC required columns
    const header = lines[0]!.toLowerCase();
    expect(header).toContain("id");
    expect(header).toContain("title");
    expect(header).toContain("price");
  });

  it("SUPPORTED_FORMATS contains all 4 formats", () => {
    expect(SUPPORTED_FORMATS).toContain("xlsx");
    expect(SUPPORTED_FORMATS).toContain("csv");
    expect(SUPPORTED_FORMATS).toContain("json");
    expect(SUPPORTED_FORMATS).toContain("gmc");
    expect(SUPPORTED_FORMATS).toHaveLength(4);
  });

  it("rejects unsupported format", async () => {
    const outPath = resolve(TEST_EXPORT_DIR, "test.pdf");
    await expect(
      exportProducts(testProducts, outPath, "pdf" as any),
    ).rejects.toThrow("Unsupported");
  });
});
