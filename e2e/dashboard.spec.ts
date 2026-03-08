import { test, expect, type Page } from "@playwright/test";
import { saveProducts, clearStore } from "../src/store/local-store.js";
import { makeTestProducts } from "./fixtures.js";

const PRODUCTS = makeTestProducts(32);

test.beforeAll(async () => {
  await clearStore("default");
  await saveProducts(PRODUCTS, "default");
});

test.afterAll(async () => {
  await clearStore("default");
});

// ── US-E2E-01: Dashboard loads with products table ──────────────────────────
test("US-E2E-01: dashboard loads with stats and charts", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/HarvestHub/);

  // Stats grid shows "Total Products" with value > 0
  const totalProducts = page.locator("#totalProducts");
  await expect(totalProducts).not.toHaveText("—", { timeout: 10_000 });
  const text = await totalProducts.textContent();
  expect(Number(text?.replace(/,/g, ""))).toBeGreaterThan(0);

  // Charts are visible
  await expect(page.locator("#brandsChart")).not.toBeEmpty();
  await expect(page.locator("#categoriesChart")).not.toBeEmpty();
});

// ── US-E2E-02: Search/filter functionality ──────────────────────────────────
test("US-E2E-02: search filters products by title", async ({ page }) => {
  await page.goto("/");
  // Navigate to Products
  await page.locator(".nav-item", { hasText: "Products" }).click();
  await expect(page.locator("#page-products")).toBeVisible();

  // Wait for products to load
  await expect(page.locator("#productsTable tr").first()).toBeVisible({
    timeout: 10_000,
  });

  // Type "Alpha" in search
  await page.fill("#searchInput", "Alpha");
  // Wait for debounce + reload
  await page.waitForTimeout(500);
  await expect(page.locator("#productsTable tr").first()).toBeVisible({
    timeout: 5_000,
  });

  // All visible rows should contain "Alpha"
  const rows = page.locator("#productsTable tr");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).textContent();
    expect(text?.toLowerCase()).toContain("alpha");
  }
});

test("US-E2E-02b: brand filter works", async ({ page }) => {
  await page.goto("/");
  await page.locator(".nav-item", { hasText: "Products" }).click();
  await expect(page.locator("#page-products")).toBeVisible();
  await expect(page.locator("#productsTable tr").first()).toBeVisible({
    timeout: 10_000,
  });

  // Select first real brand in dropdown (skip "All Brands")
  const brandFilter = page.locator("#brandFilter");
  const options = brandFilter.locator("option");
  const optionCount = await options.count();
  if (optionCount > 1) {
    const brandValue = await options.nth(1).getAttribute("value");
    await brandFilter.selectOption(brandValue!);
    await page.waitForTimeout(500);
    await expect(page.locator("#productsTable tr").first()).toBeVisible({
      timeout: 5_000,
    });
    const rows = page.locator("#productsTable tr");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  }
});

// ── US-E2E-03: Pagination works ─────────────────────────────────────────────
test("US-E2E-03: pagination next/prev buttons work", async ({ page }) => {
  await page.goto("/");
  await page.locator(".nav-item", { hasText: "Products" }).click();
  await expect(page.locator("#page-products")).toBeVisible();
  await expect(page.locator("#productsTable tr").first()).toBeVisible({
    timeout: 10_000,
  });

  const paginationInfo = page.locator("#paginationInfo");
  await expect(paginationInfo).toContainText("Page 1 of");

  // Prev should be disabled on page 1
  await expect(page.locator("#prevBtn")).toBeDisabled();

  // Next should be enabled (32 products, 25 per page = 2 pages)
  const nextBtn = page.locator("#nextBtn");
  await expect(nextBtn).toBeEnabled();

  // Click Next
  await nextBtn.click();
  await expect(paginationInfo).toContainText("Page 2 of");
  await expect(page.locator("#prevBtn")).toBeEnabled();

  // Click Prev
  await page.locator("#prevBtn").click();
  await expect(paginationInfo).toContainText("Page 1 of");
});

// ── US-E2E-04: Product rows show correct data fields ────────────────────────
test("US-E2E-04: product rows display expected fields", async ({ page }) => {
  await page.goto("/");
  await page.locator(".nav-item", { hasText: "Products" }).click();
  await expect(page.locator("#page-products")).toBeVisible();
  await expect(page.locator("#productsTable tr").first()).toBeVisible({
    timeout: 10_000,
  });

  const firstRow = page.locator("#productsTable tr").first();
  const cells = firstRow.locator("td");

  // Should have 7 columns: title, price, brand, availability, category, confidence, link
  const cellCount = await cells.count();
  expect(cellCount).toBe(7);

  // Title cell is non-empty
  const title = await cells.nth(0).textContent();
  expect(title?.trim().length).toBeGreaterThan(0);

  // Price cell has a number
  const priceText = await cells.nth(1).textContent();
  expect(priceText).toMatch(/\d+\.\d+/);

  // Availability badge exists
  const availBadge = cells.nth(3).locator(".badge");
  await expect(availBadge).toBeVisible();

  // Confidence meter exists
  const confBar = cells.nth(5).locator(".confidence");
  await expect(confBar).toBeVisible();

  // Visit link exists
  const visitLink = cells.nth(6).locator("a");
  await expect(visitLink).toHaveText(/Visit/);
});

// ── US-E2E-05: Stats section displays metrics ───────────────────────────────
test("US-E2E-05: stats cards show numeric values", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#page-dashboard")).toBeVisible();

  // Wait for stats to load
  await expect(page.locator("#totalProducts")).not.toHaveText("—", {
    timeout: 10_000,
  });

  // Total Products
  const total = await page.locator("#totalProducts").textContent();
  expect(Number(total?.replace(/,/g, ""))).toBeGreaterThan(0);

  // In Stock
  const inStock = await page.locator("#inStock").textContent();
  expect(Number(inStock?.replace(/,/g, ""))).toBeGreaterThanOrEqual(0);

  // Out of Stock
  const outOfStock = await page.locator("#outOfStock").textContent();
  expect(Number(outOfStock?.replace(/,/g, ""))).toBeGreaterThanOrEqual(0);

  // Avg Price (decimal)
  const avgPrice = await page.locator("#avgPrice").textContent();
  expect(avgPrice).toMatch(/\d+\.\d+/);

  // Avg Confidence (ends with %)
  const avgConf = await page.locator("#avgConfidence").textContent();
  expect(avgConf).toMatch(/%$/);

  // Price Range (formatted as "X – Y")
  const priceRange = await page.locator("#priceRange").textContent();
  expect(priceRange).toMatch(/\d+\s*–\s*\d+/);
});

// ── US-E2E-06: Sidebar navigation works ─────────────────────────────────────
test("US-E2E-06: sidebar navigation shows correct items and navigates", async ({
  page,
}) => {
  await page.goto("/");

  // Check sidebar nav items exist
  const navItems = [
    "Dashboard",
    "Products",
    "Exports",
    "Live Feed",
    "Schedules",
    "API Docs",
    "Documentation",
    "Marketing",
  ];
  for (const item of navItems) {
    await expect(
      page.locator(".nav-item", { hasText: item }).first(),
    ).toBeVisible();
  }

  // Click Products
  await page.locator("button.nav-item", { hasText: "Products" }).click();
  await expect(page.locator("#page-products")).toBeVisible();
  await expect(page.locator("#page-dashboard")).toBeHidden();
  await expect(
    page.locator("button.nav-item", { hasText: "Products" }),
  ).toHaveClass(/active/);

  // Click Exports
  await page.locator("button.nav-item", { hasText: "Exports" }).click();
  await expect(page.locator("#page-exports")).toBeVisible();
});

// ── US-E2E-07: Export buttons are present and clickable ─────────────────────
test("US-E2E-07: export cards are visible and clickable", async ({ page }) => {
  await page.goto("/");
  await page.locator("button.nav-item", { hasText: "Exports" }).click();
  await expect(page.locator("#page-exports")).toBeVisible();

  // Four export formats
  for (const format of ["XLSX", "CSV", "JSON", "GMC Feed"]) {
    const card = page.locator(".stat-card", { hasText: format });
    await expect(card).toBeVisible();
  }
});

// ── US-E2E-08: Responsive — mobile viewport still functional ────────────────
test("US-E2E-08: mobile viewport hides sidebar and shows content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  // Sidebar should be hidden on mobile
  const sidebar = page.locator(".sidebar");
  await expect(sidebar).toBeHidden();

  // Main content still shows stats
  await expect(page.locator("#totalProducts")).not.toHaveText("—", {
    timeout: 10_000,
  });

  // Stats grid is still visible
  await expect(page.locator("#statsGrid")).toBeVisible();
});

// ── US-E2E-09: API docs page loads ──────────────────────────────────────────
test("US-E2E-09: /api-docs loads Swagger UI", async ({ page }) => {
  await page.goto("/api-docs/");
  // Swagger UI page should load
  await expect(page.locator("text=HarvestHub API")).toBeVisible({
    timeout: 15_000,
  });
});

// ── US-E2E-10: Dark theme toggle ────────────────────────────────────────────
test("US-E2E-10: theme toggle switches between dark and light", async ({
  page,
}) => {
  await page.goto("/");

  // Default is dark (no data-theme="light")
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", "light");

  // Click theme toggle
  await page.locator("#themeToggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#themeIcon")).toHaveText("🌙");
  await expect(page.locator("#themeLabel")).toHaveText("Dark Mode");

  // Click again → back to dark
  await page.locator("#themeToggle").click();
  await expect(html).not.toHaveAttribute("data-theme", "light");
  await expect(page.locator("#themeIcon")).toHaveText("☀️");
});
