/**
 * Integration tests for the HarvestHub Express API server.
 * These tests boot a real Express instance and make HTTP requests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  saveProducts,
  clearStore,
  saveSchedule,
} from "../store/local-store.js";
import type { Product } from "../types/product.js";
import type { Schedule } from "../types/schedule.js";
import { DEFAULT_JOB_CONFIG } from "../types/index.js";

const TEST_STORE = "test-api-store";

// We test against the real createServer but with a test store.
// To avoid port conflicts, we dynamically import and create a lightweight supertest-style test.
// Since supertest isn't installed, we use Node's built-in fetch.

function makeProduct(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    sourceUrl: `https://example.com/product/${id}`,
    scrapedAt: new Date().toISOString(),
    title: `Test Product ${id}`,
    price: 29.99,
    currency: "USD",
    description: `Description for ${id}`,
    images: ["https://example.com/img.jpg"],
    availability: "in_stock",
    brand: "TestBrand",
    sku: `SKU-${id}`,
    mpn: null,
    gtin: null,
    category: "Electronics",
    rating: 4.5,
    reviewCount: 42,
    specifications: { color: "Red" },
    seller: null,
    shipping: null,
    alternativePrices: [],
    confidenceScores: { title: 95, price: 90 },
    overallConfidence: 85,
    extractionMethod: "adaptive",
    metadata: {},
    ...overrides,
  };
}

describe("API Server Integration", () => {
  let server: ReturnType<typeof import("node:http").createServer>;
  let baseUrl: string;

  beforeAll(async () => {
    // Seed the default store with test data
    await clearStore();
    await saveProducts([
      makeProduct("api-1", {
        title: "Alpha Widget",
        brand: "Acme",
        price: 10.0,
        availability: "in_stock",
        category: "Widgets",
      }),
      makeProduct("api-2", {
        title: "Beta Gadget",
        brand: "Acme",
        price: 20.0,
        availability: "out_of_stock",
        category: "Gadgets",
      }),
      makeProduct("api-3", {
        title: "Gamma Gizmo",
        brand: "Zeta",
        price: 50.0,
        availability: "in_stock",
        category: "Widgets",
      }),
    ]);

    // Dynamically import to avoid any module-level side effects
    const { createServer } = await import("../api/server.js");

    // Use a random high port to avoid conflicts
    const port = 44000 + Math.floor(Math.random() * 1000);
    const app = createServer(port);

    // Get the underlying HTTP server
    const http = await import("node:http");
    // The createServer function already calls listen internally,
    // so we need to wait for it
    baseUrl = `http://localhost:${port}`;

    // Wait for server to be ready
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    // Clean up
    await clearStore();
  });

  it("GET /api/products returns paginated products", async () => {
    const res = await fetch(`${baseUrl}/api/products`);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.products).toBeInstanceOf(Array);
    expect(body.products.length).toBeGreaterThanOrEqual(3);
    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(body.page).toBe(1);
  });

  it("GET /api/products supports search filter", async () => {
    const res = await fetch(`${baseUrl}/api/products?search=alpha`);
    const body: any = await res.json();
    expect(body.products.length).toBeGreaterThanOrEqual(1);
    expect(body.products[0].title.toLowerCase()).toContain("alpha");
  });

  it("GET /api/products supports brand filter", async () => {
    const res = await fetch(`${baseUrl}/api/products?brand=acme`);
    const body: any = await res.json();
    expect(body.products.length).toBeGreaterThanOrEqual(2);
    for (const p of body.products) {
      expect(p.brand.toLowerCase()).toContain("acme");
    }
  });

  it("GET /api/products supports availability filter", async () => {
    const res = await fetch(
      `${baseUrl}/api/products?availability=out_of_stock`,
    );
    const body: any = await res.json();
    for (const p of body.products) {
      expect(p.availability).toBe("out_of_stock");
    }
  });

  it("GET /api/products supports pagination", async () => {
    const res = await fetch(`${baseUrl}/api/products?page=1&limit=2`);
    const body: any = await res.json();
    expect(body.products.length).toBeLessThanOrEqual(2);
    expect(body.limit).toBe(2);
  });

  it("GET /api/stats returns aggregated statistics", async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.totalProducts).toBeGreaterThanOrEqual(3);
    expect(body.avgPrice).toBeGreaterThan(0);
    expect(body.avgConfidence).toBeGreaterThan(0);
    expect(body.priceRange).toHaveProperty("min");
    expect(body.priceRange).toHaveProperty("max");
    expect(body.topBrands).toBeInstanceOf(Array);
    expect(body.topCategories).toBeInstanceOf(Array);
  });

  it("GET /api/products/:id/history returns price history", async () => {
    const res = await fetch(`${baseUrl}/api/products/api-1/history`);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.id).toBe("api-1");
    expect(body.title).toBe("Alpha Widget");
    expect(body.currentPrice).toBe(10.0);
    expect(body.priceHistory).toBeInstanceOf(Array);
  });

  it("GET /api/products/:id/history returns 404 for missing product", async () => {
    const res = await fetch(`${baseUrl}/api/products/nonexistent/history`);
    expect(res.status).toBe(404);
  });

  it("GET /api/jobs returns jobs array", async () => {
    const res = await fetch(`${baseUrl}/api/jobs`);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.jobs).toBeInstanceOf(Array);
  });

  it("GET /api/status returns system status", async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body).toHaveProperty("engine");
    expect(body).toHaveProperty("productCount");
    expect(body).toHaveProperty("uptime");
    expect(body.productCount).toBeGreaterThanOrEqual(3);
  });

  it("GET /api/export/:format rejects unsupported format", async () => {
    const res = await fetch(`${baseUrl}/api/export/pdf`);
    expect(res.status).toBe(400);
  });

  // Schedule API tests
  it("POST /api/schedules creates a schedule", async () => {
    const res = await fetch(`${baseUrl}/api/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Integration Test Schedule",
        cronExpression: "0 12 * * *",
        urlSource: "test-urls.txt",
      }),
    });
    expect(res.status).toBe(201);

    const body: any = await res.json();
    expect(body.schedule).toBeTruthy();
    expect(body.schedule.name).toBe("Integration Test Schedule");
    expect(body.schedule.cronExpression).toBe("0 12 * * *");
    expect(body.schedule.enabled).toBe(true);
  });

  it("GET /api/schedules lists schedules", async () => {
    const res = await fetch(`${baseUrl}/api/schedules`);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.schedules).toBeInstanceOf(Array);
    expect(body.schedules.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/schedules rejects incomplete data", async () => {
    const res = await fetch(`${baseUrl}/api/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Missing fields" }),
    });
    expect(res.status).toBe(400);
  });
});
