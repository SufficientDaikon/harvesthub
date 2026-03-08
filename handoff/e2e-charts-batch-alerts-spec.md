# HarvestHub — Feature Specification: E2E Tests, Price Charts, Batch Import, Alerts

**Spec ID:** HH-SPEC-004  
**Version:** 1.0  
**Date:** 2025-01-15  
**Status:** Ready for Implementation  
**Author:** Specification Architect (SDD Agent)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [User Scenarios & Stories](#2-user-scenarios--stories)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Key Entities & Data Model](#5-key-entities--data-model)
6. [Success Criteria](#6-success-criteria)
7. [Edge Cases & Error Handling](#7-edge-cases--error-handling)
8. [Assumptions & Dependencies](#8-assumptions--dependencies)
9. [Out of Scope](#9-out-of-scope)
10. [File-Level Implementation Map](#10-file-level-implementation-map)
11. [Acceptance Checklist](#11-acceptance-checklist)

---

## 1. Project Overview

### 1.1 What We're Building

Four interconnected features for HarvestHub, an existing TypeScript+Python hybrid web scraping platform:

1. **E2E Tests with Playwright** — Browser-based integration tests exercising the dashboard and API
2. **Price Tracking Charts** — Interactive Chart.js visualizations in the dashboard for price intelligence
3. **Batch URL Import** — Dashboard UI + API to paste/upload URLs in bulk and track scraping progress
4. **Email/Webhook Alerts** — Configurable price-drop alerts dispatched via webhook POST or SMTP email

### 1.2 Why

- **E2E Tests:** The project has 111 vitest unit/integration tests but zero browser-level tests. Regressions in the HTML dashboard, sidebar navigation, search/filter, pagination, and static-mode mock data go undetected.
- **Price Charts:** The existing `price-differ.ts` and `Product.priceHistory` already capture price changes, but there is no visualization. Users cannot see trends at a glance.
- **Batch Import:** Users can only scrape via CLI (`harvest scrape -u file.txt`) or the scheduler. There is no dashboard UI for ad-hoc bulk URL submission and progress tracking.
- **Alerts:** Price drops are logged but not pushed to users. There is no mechanism to notify users when a monitored product's price changes beyond a threshold.

### 1.3 For Whom

| Actor                 | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| **Dashboard User**    | Views products, charts, submits batch scrapes, configures alerts in the browser |
| **Developer**         | Runs E2E tests locally and in CI, extends the API                               |
| **Ops / CI Pipeline** | Runs E2E tests after vitest in the GitHub Actions workflow                      |
| **External System**   | Receives webhook POST payloads when alerts fire                                 |

### 1.4 Current State Summary

| Aspect                         | Current State                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Express API**                | 10+ endpoints on port 3000 (configurable), Swagger at `/api-docs`                                                                                                                                         |
| **Dashboard**                  | Single `dashboard/index.html` with STATIC_MODE (32 mock products), dark/light theme, 6 pages (Dashboard, Products, Exports, Live Feed, Schedules, API Docs + Documentation + Marketing + Arabic variants) |
| **Sidebar nav items**          | Dashboard, Products, Exports, Live Feed, Schedules, API Docs, Documentation, Marketing, عربي, GitHub                                                                                                      |
| **Product type**               | Has `priceHistory?: Array<{ price, currency, recordedAt }>` — already populated by `diffAndMerge()` in `price-differ.ts`                                                                                  |
| **Storage**                    | JSON files at `data/store/default.json` via `local-store.ts` — stores products, jobs, schedules                                                                                                           |
| **Existing price history API** | `GET /api/products/:id/history` already exists in `server.ts`                                                                                                                                             |
| **CLI**                        | Commander-based at `src/cli/index.ts` with subcommands: scrape, export, status, migrate, dashboard, schedule                                                                                              |
| **Tests**                      | 111 vitest tests in `src/__tests__/`, 0 Playwright tests                                                                                                                                                  |
| **CI**                         | `.github/workflows/ci.yml` — node 20.x/22.x matrix, npm ci, pip install, tsc, vitest                                                                                                                      |
| **Module system**              | ESM (`"type": "module"` in package.json), TS target ES2022, moduleResolution bundler                                                                                                                      |

---

## 2. User Scenarios & Stories

### FEATURE 1: E2E Tests with Playwright

#### US-E2E-01: Dashboard loads with products table (P1)

> **As a** developer  
> **I want** a Playwright test that verifies the dashboard loads correctly  
> **So that** I can catch rendering regressions before deployment

**Acceptance Scenarios:**

```
Given the Express server is running with seeded product data
When a browser navigates to the root URL "/"
Then the page title contains "HarvestHub"
  And the stats grid shows "Total Products" with a numeric value > 0
  And the "Top Brands" chart section is visible and not empty
  And the "Top Categories" chart section is visible and not empty
```

#### US-E2E-02: Search/filter functionality works (P1)

> **As a** developer  
> **I want** E2E tests that verify search and filtering on the Products page  
> **So that** search input, brand dropdown, and availability filter are exercised

**Acceptance Scenarios:**

```
Given the Products page is active and populated with seeded data
When the user types "Alpha" into the search input (#searchInput)
Then the products table filters to show only products whose title contains "Alpha"
  And the pagination info updates to reflect the filtered count

When the user selects a brand from the brand dropdown (#brandFilter)
Then only products of that brand are displayed

When the user selects "in_stock" from the availability filter (#availFilter)
Then only in-stock products are displayed
```

#### US-E2E-03: Pagination works (P1)

> **As a** developer  
> **I want** E2E tests verifying Next/Prev pagination buttons  
> **So that** multi-page product lists are navigable

**Acceptance Scenarios:**

```
Given there are more than 25 products in the store (since limit defaults to 25)
When the Products page loads
Then the pagination shows "Page 1 of N"
  And the "Prev" button is disabled
  And the "Next" button is enabled

When the user clicks "Next →"
Then the pagination updates to "Page 2 of N"
  And the "Prev" button becomes enabled
  And the table content changes

When the user clicks "← Prev"
Then the pagination returns to "Page 1 of N"
```

#### US-E2E-04: Product rows show correct data fields (P1)

> **As a** developer  
> **I want** E2E tests verifying each product row displays the expected fields  
> **So that** data rendering fidelity is validated

**Acceptance Scenarios:**

```
Given the Products page is active with seeded products
Then each product row contains:
  - A title cell (non-empty text)
  - A price cell (matching pattern: number + currency code)
  - A brand cell
  - An availability badge (In Stock / Out of Stock / Unknown)
  - A category cell
  - A confidence meter with a percentage value
  - A "Visit ↗" link pointing to the source URL
```

#### US-E2E-05: Stats section displays metrics (P1)

> **As a** developer  
> **I want** tests that validate the Dashboard stats cards  
> **So that** aggregate statistics render correctly

**Acceptance Scenarios:**

```
Given the Dashboard page is active
Then the following stat cards are visible and contain numeric values:
  - "Total Products" (#totalProducts)
  - "In Stock" (#inStock)
  - "Out of Stock" (#outOfStock)
  - "Avg Price" (#avgPrice) — formatted as decimal (e.g., "49.99")
  - "Avg Confidence" (#avgConfidence) — ends with "%"
  - "Price Range" (#priceRange) — formatted as "X – Y"
```

#### US-E2E-06: Sidebar navigation works (P1)

> **As a** developer  
> **I want** tests that validate all sidebar links are present and functional  
> **So that** navigation doesn't regress

**Acceptance Scenarios:**

```
Given the page is loaded at "/"
Then the sidebar contains nav items with text:
  - "Dashboard"
  - "Products"
  - "Exports"
  - "Live Feed"
  - "Schedules"
  - "API Docs" (link to /api-docs)
  - "Documentation" (link to docs.html)
  - "Marketing" (link to marketing.html)

When the user clicks "Products" nav item
Then the #page-products section becomes visible
  And the #page-dashboard section becomes hidden
  And the "Products" nav item has the "active" class

When the user clicks "Exports" nav item
Then the #page-exports section becomes visible
```

#### US-E2E-07: Export buttons are present and clickable (P1)

> **As a** developer  
> **I want** tests that validate export cards are rendered  
> **So that** the export feature surface is verified

**Acceptance Scenarios:**

```
Given the Exports page is active
Then four export cards are visible with text: "XLSX", "CSV", "JSON", "GMC Feed"
  And each card has a click handler (is clickable / not disabled)
```

#### US-E2E-08: Responsive — mobile viewport still functional (P2)

> **As a** developer  
> **I want** tests that validate the dashboard at mobile viewport  
> **So that** responsive breakpoints are verified

**Acceptance Scenarios:**

```
Given the viewport is set to 375×667 (iPhone SE)
When the page loads
Then the sidebar is hidden (display: none at ≤768px per existing CSS)
  And the main content occupies the full width
  And the stats grid still shows stat cards
  And the products table is visible and scrollable
```

#### US-E2E-09: API docs page loads (P2)

> **As a** developer  
> **I want** a test that verifies /api-docs loads the Swagger UI  
> **So that** the API documentation endpoint doesn't regress

**Acceptance Scenarios:**

```
Given the server is running
When a browser navigates to "/api-docs"
Then the page loads without errors
  And the page contains "HarvestHub API" text (the Swagger info title)
  And the Swagger UI renders endpoint sections
```

#### US-E2E-10: Dark theme is applied correctly (P2)

> **As a** developer  
> **I want** a test that verifies the dark/light theme toggle  
> **So that** theming doesn't regress

**Acceptance Scenarios:**

```
Given the page loads (default theme is dark)
Then the <html> element does NOT have data-theme="light"
  And the body background color is dark (--bg-primary: #0f0f23)

When the user clicks the theme toggle button (#themeToggle)
Then the <html> element has data-theme="light"
  And the theme icon changes to "🌙"
  And the theme label changes to "Dark Mode"

When the user clicks the theme toggle button again
Then the <html> element does NOT have data-theme="light"
  And the theme icon changes to "☀️"
```

---

### FEATURE 2: Price Tracking Charts

#### US-PRC-01: View price history line chart for a product (P1)

> **As a** dashboard user  
> **I want** to select a product and see its price over time as a line chart  
> **So that** I can spot price trends and make informed purchasing decisions

**Acceptance Scenarios:**

```
Given the "Price Intelligence" page is active in the dashboard
When the user selects a product from the product dropdown
Then a line chart renders showing price (Y-axis) over time (X-axis)
  And the chart title shows the selected product name
  And the current price is displayed prominently

When the user selects a time range (7d, 30d, 90d, all)
Then the chart X-axis adjusts to show only data within that range
  And data points outside the range are excluded
```

#### US-PRC-02: View price distribution bar chart (P1)

> **As a** dashboard user  
> **I want** a bar chart showing how product prices are distributed across buckets  
> **So that** I can understand the pricing landscape at a glance

**Acceptance Scenarios:**

```
Given the "Price Intelligence" page is active
Then a bar/histogram chart shows price distribution buckets
  (e.g., $0-50, $50-100, $100-200, $200-500, $500-1000, $1000+)
  And each bar shows the count of products in that range
  And the chart updates when the product data changes
```

#### US-PRC-03: See price change indicators in product table (P1)

> **As a** dashboard user  
> **I want** mini sparkline-style indicators in the product table  
> **So that** I can see price trends inline without navigating away

**Acceptance Scenarios:**

```
Given the Products table is rendered
Then each product row with priceHistory data shows a small inline trend indicator:
  - A mini sparkline (small canvas/SVG) showing the price trajectory
  OR at minimum the existing ↑↓→ arrows augmented with percentage change text
```

**Implementation note:** The existing `priceTrendBadge(p)` function already renders ↑↓→ arrows. This story extends it with actual percentage text and optionally a mini sparkline canvas.

#### US-PRC-04: View biggest price drops and increases (P1)

> **As a** dashboard user  
> **I want** summary cards showing the products with the biggest price changes  
> **So that** I can quickly identify deals and price hikes

**Acceptance Scenarios:**

```
Given the "Price Intelligence" page is active
Then a "Biggest Drops" card shows up to 5 products with the largest negative price changes
  Each showing: product title, old price → new price, percentage change
And a "Biggest Increases" card shows up to 5 products with the largest positive price changes
  Each showing: product title, old price → new price, percentage change
```

#### US-PRC-05: Price Intelligence in STATIC_MODE (P1)

> **As a** developer deploying to GitHub Pages  
> **I want** the Price Intelligence page to work in STATIC_MODE with mock data  
> **So that** the demo site showcases the feature without a live server

**Acceptance Scenarios:**

```
Given the dashboard loads in STATIC_MODE (not localhost)
When the user navigates to the Price Intelligence page
Then mock price history data renders in the line chart
  And the price distribution chart renders with mock product prices
  And the biggest drops/increases cards show mock data
  And all charts are interactive (dropdown works, time range works)
```

---

### FEATURE 3: Batch URL Import

#### US-BAT-01: Paste URLs and start batch scraping (P1)

> **As a** dashboard user  
> **I want** to paste a list of URLs and click "Start Scraping"  
> **So that** I can submit ad-hoc scraping jobs from the browser

**Acceptance Scenarios:**

```
Given the "Batch Import" page is active
When the user pastes 5 URLs (one per line) into the textarea
Then URL validation runs inline:
  - Valid URLs show a green ✓ indicator
  - Invalid lines show a red ✗ indicator with reason (e.g., "Invalid URL format")
And the "Start Scraping" button shows the valid URL count (e.g., "Scrape 5 URLs")

When the user clicks "Start Scraping"
Then the API receives a POST /api/batch with { urls: [...] }
  And the UI switches to a progress view showing:
    - Overall progress bar (X of Y)
    - Per-URL status (pending → scraping → success/fail)
    - Running success and failure counts

When all URLs are processed
Then a results summary is displayed:
  - Total processed, succeeded, failed
  - For each URL: status and product title (if success) or error message (if failure)
```

#### US-BAT-02: Upload a file of URLs (P1)

> **As a** dashboard user  
> **I want** to upload a .txt or .csv file containing URLs  
> **So that** I can import bulk URLs without manual pasting

**Acceptance Scenarios:**

```
Given the "Batch Import" page is active
When the user clicks "Upload File" and selects a .txt file
Then the file contents are parsed (one URL per line, # comments stripped)
  And the parsed URLs populate the textarea
  And URL validation runs on all parsed URLs

When the user clicks "Upload File" and selects a .csv file
Then URLs are extracted (one per line, first column if CSV has multiple columns)
  And the parsed URLs populate the textarea

When the user uploads an unsupported file type (e.g., .xlsx)
Then an error message is shown: "Only .txt and .csv files are supported"
```

#### US-BAT-03: Batch processing tracks per-URL progress (P1)

> **As a** dashboard user  
> **I want** real-time progress tracking for my batch job  
> **So that** I know which URLs succeeded and which failed

**Acceptance Scenarios:**

```
Given a batch job is running
When the user polls GET /api/batch/:jobId
Then the response includes:
  - jobId, status (running/completed/failed)
  - totalUrls, completedUrls, failedUrls
  - results: Array of { url, status (pending/success/failed), productTitle?, error? }

When all URLs are processed
Then the job status changes to "completed"
  And the completedUrls + failedUrls equals totalUrls
```

#### US-BAT-04: Batch Import in STATIC_MODE (P2)

> **As a** developer deploying to GitHub Pages  
> **I want** the Batch Import page to work in STATIC_MODE  
> **So that** visitors can see the feature's UI

**Acceptance Scenarios:**

```
Given STATIC_MODE is active
When the user pastes URLs and clicks "Start Scraping"
Then a simulated progress animation plays:
  - Progress bar advances over ~3 seconds
  - Each URL transitions through pending → scraping → success (simulated)
  - A mock results summary is shown at the end
  And no real API calls are made
```

#### US-BAT-05: CLI batch command (P2)

> **As a** developer  
> **I want** a `harvesthub batch <file>` CLI command  
> **So that** I can submit batch scrapes from the terminal

**Acceptance Scenarios:**

```
Given a file `urls.txt` with 3 valid URLs
When the user runs `harvest batch urls.txt`
Then the CLI reads URLs from the file (using existing parseUrlFile)
  And runs them through runScrapeJob
  And prints a summary (succeeded/failed/elapsed)
```

---

### FEATURE 4: Email/Webhook Alerts

#### US-ALR-01: Configure a price-drop alert (P1)

> **As a** dashboard user  
> **I want** to create an alert rule: "notify me when product X's price drops by more than N%"  
> **So that** I don't miss significant price changes

**Acceptance Scenarios:**

```
Given the "Alerts" page is active
When the user fills the alert form:
  - Selects a product URL or domain filter
  - Sets threshold: 10%
  - Enters a webhook URL (e.g., https://hooks.slack.com/...)
  And clicks "Create Alert"
Then POST /api/alerts is called with { productUrl, threshold, webhookUrl }
  And the alert appears in the alerts table
  And a success toast/message confirms creation

When the alert is listed in the table
Then it shows: product/domain, threshold, method (webhook/email), created date
```

#### US-ALR-02: Receive webhook on price drop (P1)

> **As an** external system  
> **I want** to receive a POST webhook when a monitored product's price drops beyond the threshold  
> **So that** I can trigger downstream actions (Slack notification, database update, etc.)

**Acceptance Scenarios:**

```
Given an alert exists: productUrl=https://example.com/widget, threshold=10%, webhookUrl=https://hooks.example.com/notify
When the scraper re-scrapes https://example.com/widget
  And the new price is ≥10% lower than the previous price
Then a POST request is sent to https://hooks.example.com/notify with JSON body:
  {
    "productTitle": "Widget Pro",
    "productUrl": "https://example.com/widget",
    "oldPrice": 100.00,
    "newPrice": 85.00,
    "changePercent": -15.00,
    "currency": "USD",
    "triggeredAt": "2025-01-15T10:30:00Z"
  }
  And the alert history records this trigger event

When the price drop is less than the threshold (e.g., 5% drop with 10% threshold)
Then no webhook is sent
```

#### US-ALR-03: Receive email on price drop (P2)

> **As a** dashboard user  
> **I want** to receive an email when a monitored product's price drops  
> **So that** I get notified even without a webhook endpoint

**Acceptance Scenarios:**

```
Given an alert exists with email="user@example.com" and threshold=15%
  And SMTP environment variables are configured (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
When the price of the monitored product drops by ≥15%
Then an email is sent via the configured SMTP to user@example.com
  With subject: "🔔 HarvestHub Alert: Price dropped for {product title}"
  And body containing: product title, old price, new price, change percent, link to product

When SMTP is not configured (env vars missing)
Then email delivery is skipped with a warning log
  And the webhook (if configured) still fires normally
```

#### US-ALR-04: View alert history (P1)

> **As a** dashboard user  
> **I want** to view a history of all triggered alerts  
> **So that** I can see what notifications were sent and when

**Acceptance Scenarios:**

```
Given the "Alerts" page is active
Then an "Alert History" table is visible below the alerts configuration
  And each row shows: timestamp, product title, old price → new price, change %, delivery method, delivery status (sent/failed)

When GET /api/alerts/history is called
Then it returns an array of alert history records sorted by triggeredAt descending
```

#### US-ALR-05: Delete an alert (P1)

> **As a** dashboard user  
> **I want** to delete an alert I no longer need  
> **So that** I stop receiving notifications for it

**Acceptance Scenarios:**

```
Given an alert exists in the table
When the user clicks the "Delete" button on that alert
Then a confirmation prompt appears
When confirmed, DELETE /api/alerts/:id is called
  And the alert is removed from the table
  And future price changes for that product do not trigger it
```

#### US-ALR-06: Alerts in STATIC_MODE (P2)

> **As a** developer deploying to GitHub Pages  
> **I want** the Alerts page to work in STATIC_MODE with mock data  
> **So that** visitors can explore the feature UI

**Acceptance Scenarios:**

```
Given STATIC_MODE is active
When the user navigates to the "Alerts" page
Then mock alerts are displayed in the table (3-5 sample alerts)
  And mock alert history is displayed (5-8 sample triggered alerts)
  And the "Create Alert" form is visible but shows a notice when submitted:
    "Alert management requires the local server."
```

---

## 3. Functional Requirements

### 3.1 Feature 1: E2E Tests with Playwright

| ID         | Requirement                                                                                                                                                                                                                                                                | Traces To                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| FR-E2E-001 | Install `@playwright/test` as a devDependency.                                                                                                                                                                                                                             | US-E2E-01                |
| FR-E2E-002 | Create `playwright.config.ts` at the project root. Configure: baseURL from `webServer` (see FR-E2E-003), screenshot on failure to `e2e/screenshots/`, use `chromium` project at minimum. Timeout per test: 30s.                                                            | US-E2E-01                |
| FR-E2E-003 | Configure `webServer` in Playwright config to start the Express server before tests. Use `npx tsx src/api/start.ts` as the command. Set port to 3000 (matching `start.ts` default). Set `reuseExistingServer: !process.env.CI`.                                            | US-E2E-01                |
| FR-E2E-004 | Create `e2e/` directory with at least one test file `e2e/dashboard.spec.ts` (may split into multiple files).                                                                                                                                                               | US-E2E-01                |
| FR-E2E-005 | Before the E2E test suite runs, seed the store with ≥30 test products using the `saveProducts` function from `local-store.ts` (so the data is deterministic). Use a `globalSetup` or a `beforeAll` in a shared fixture. After the suite, clean the store via `clearStore`. | US-E2E-01 thru US-E2E-10 |
| FR-E2E-006 | Implement minimum 10 test cases covering all 10 user stories (US-E2E-01 through US-E2E-10). Each test must assert at least one visible element or behavior.                                                                                                                | US-E2E-01 thru US-E2E-10 |
| FR-E2E-007 | Add npm script: `"test:e2e": "playwright test"` to `package.json`.                                                                                                                                                                                                         | US-E2E-01                |
| FR-E2E-008 | Add Playwright step to `.github/workflows/ci.yml` after the vitest step. Must install Playwright browsers (`npx playwright install --with-deps chromium`). Run `npx playwright test`. Upload screenshots artifact on failure.                                              | US-E2E-01                |
| FR-E2E-009 | Screenshots on failure are saved to `e2e/screenshots/` directory. Add `e2e/screenshots/` to `.gitignore` (or create one if needed).                                                                                                                                        | US-E2E-01                |
| FR-E2E-010 | The `tsconfig.json` `include` array must include the `e2e/` directory (or create a separate `e2e/tsconfig.json`).                                                                                                                                                          | US-E2E-01                |

### 3.2 Feature 2: Price Tracking Charts

| ID         | Requirement                                                                                                                                                                                                                                                                                                                                                            | Traces To |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-PRC-001 | Add Chart.js via CDN `<script>` tag to `dashboard/index.html`. Use version 4.x from `https://cdn.jsdelivr.net/npm/chart.js`. No npm install needed — this is a standalone HTML file.                                                                                                                                                                                   | US-PRC-01 |
| FR-PRC-002 | Add a new "Price Intelligence" page section in `dashboard/index.html` (a `<div id="page-price-intel">`) following the same pattern as existing pages (hidden by default, shown via `showPage('price-intel')`).                                                                                                                                                         | US-PRC-01 |
| FR-PRC-003 | Add sidebar nav item: "📊 Price Intelligence" button with `onclick="showPage('price-intel')"`. Place it between "Exports" and "Live Feed" in the sidebar.                                                                                                                                                                                                              | US-PRC-01 |
| FR-PRC-004 | The Price Intelligence page contains a **product selector dropdown** populated with product titles from `/api/products`.                                                                                                                                                                                                                                               | US-PRC-01 |
| FR-PRC-005 | The Price Intelligence page contains a **time range selector** with options: 7d, 30d, 90d, All. Default: "All".                                                                                                                                                                                                                                                        | US-PRC-01 |
| FR-PRC-006 | When a product is selected, render a **line chart** (Chart.js) showing price (Y-axis) over time (X-axis) using the product's `priceHistory` array plus current price. Fetch data from `GET /api/products/:id/history` (already exists).                                                                                                                                | US-PRC-01 |
| FR-PRC-007 | The line chart visually distinguishes data points. Use the dashboard's existing color scheme (`--accent`, `--success`, etc.). Include tooltips showing exact price and date on hover.                                                                                                                                                                                  | US-PRC-01 |
| FR-PRC-008 | When the time range selector changes, filter the price history data to only include entries within the selected range and re-render the chart.                                                                                                                                                                                                                         | US-PRC-01 |
| FR-PRC-009 | Display **price change indicators** next to the current price on the Price Intelligence page: an arrow (↑↓→) with the absolute delta and percentage change compared to the oldest history entry in the selected range. Color: green for drop, red for increase.                                                                                                        | US-PRC-04 |
| FR-PRC-010 | Render a **bar chart / histogram** (Chart.js) showing price distribution across all products. Use price buckets: $0–50, $50–100, $100–200, $200–500, $500–1000, $1000+. Data source: `/api/analytics/price-distribution`.                                                                                                                                              | US-PRC-02 |
| FR-PRC-011 | Add API endpoint `GET /api/analytics/price-distribution`. Returns an array of `{ bucket: string, count: number }` objects. Bucket boundaries: [0, 50, 100, 200, 500, 1000, Infinity]. Add Swagger annotations.                                                                                                                                                         | US-PRC-02 |
| FR-PRC-012 | Render **"Biggest Drops"** and **"Biggest Increases"** summary cards on the Price Intelligence page. Each card shows up to 5 products sorted by percentage change. Data source: `/api/analytics/price-changes`.                                                                                                                                                        | US-PRC-04 |
| FR-PRC-013 | Add API endpoint `GET /api/analytics/price-changes`. Returns `{ drops: PriceChange[], increases: PriceChange[] }` where each entry has `{ productId, title, sourceUrl, oldPrice, newPrice, changePercent, currency }`. Limit to top 10 each. Compute by comparing each product's current price to the earliest entry in their `priceHistory`. Add Swagger annotations. | US-PRC-04 |
| FR-PRC-014 | Enhance the existing `priceTrendBadge(p)` function in the Products table to also display the **percentage change** text next to the arrow (e.g., "↓ −12.5%").                                                                                                                                                                                                          | US-PRC-03 |
| FR-PRC-015 | For STATIC_MODE: extend `MOCK_PRODUCTS` priceHistory arrays to include at least 4-6 data points per product spanning multiple months, so charts look populated. Add mock returns for `/api/analytics/price-distribution` and `/api/analytics/price-changes` in the `getMockData` function.                                                                             | US-PRC-05 |

### 3.3 Feature 3: Batch URL Import

| ID         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Traces To            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| FR-BAT-001 | Add sidebar nav item: "📥 Batch Import" button with `onclick="showPage('batch')"`. Place it between "Price Intelligence" and "Live Feed".                                                                                                                                                                                                                                                                                                                                           | US-BAT-01            |
| FR-BAT-002 | Add a new "Batch Import" page section in `dashboard/index.html` (`<div id="page-batch">`).                                                                                                                                                                                                                                                                                                                                                                                          | US-BAT-01            |
| FR-BAT-003 | The Batch Import page contains a **textarea** for pasting URLs (one per line), with placeholder text: "Paste product URLs here, one per line…". Minimum height: 150px.                                                                                                                                                                                                                                                                                                              | US-BAT-01            |
| FR-BAT-004 | The Batch Import page contains a **file upload button** that accepts `.txt` and `.csv` files only (`accept=".txt,.csv"`). When a file is selected, its contents are parsed and inserted into the textarea. Lines starting with `#` are stripped (comments).                                                                                                                                                                                                                         | US-BAT-02            |
| FR-BAT-005 | **URL validation**: When the textarea content changes (debounced 500ms), validate each non-empty line as a URL. Display a validation indicator next to each URL: green ✓ for valid, red ✗ for invalid with a short reason. Count valid URLs and show on the submit button: "Scrape N URLs".                                                                                                                                                                                         | US-BAT-01            |
| FR-BAT-006 | The "Start Scraping" button is **disabled** when there are 0 valid URLs.                                                                                                                                                                                                                                                                                                                                                                                                            | US-BAT-01            |
| FR-BAT-007 | Add API endpoint `POST /api/batch`. Request body: `{ urls: string[] }`. Validates URLs server-side. Creates a batch job with a unique `jobId` (nanoid). Stores job metadata in an in-memory `Map<string, BatchJob>`. Returns `{ jobId }` immediately (HTTP 202 Accepted). Starts async processing using the existing `runScrapeJob` from `core/job-runner.ts`. Add Swagger annotations.                                                                                             | US-BAT-01, US-BAT-03 |
| FR-BAT-008 | Add API endpoint `GET /api/batch/:jobId`. Returns the batch job status: `{ jobId, status, totalUrls, completedUrls, failedUrls, results: Array<{ url, status, productTitle?, error? }> }`. Returns 404 if jobId not found. Add Swagger annotations.                                                                                                                                                                                                                                 | US-BAT-03            |
| FR-BAT-009 | Add API endpoint `POST /api/batch/upload`. Accepts `multipart/form-data` with a `file` field. Parses URLs from the uploaded file (one per line, strip comments). Returns `{ urls: string[], invalid: string[] }`. Use Express built-in or a lightweight approach (read the raw body, no heavy dependency like multer — or install multer if already in deps; it's not currently installed, so parse the multipart manually or add multer as a dependency). Add Swagger annotations. | US-BAT-02            |
| FR-BAT-010 | The dashboard client **polls** `GET /api/batch/:jobId` every 2 seconds while the job is running. Updates the UI: progress bar, per-URL status rows, success/fail counters. Stops polling when status is "completed" or "failed".                                                                                                                                                                                                                                                    | US-BAT-03            |
| FR-BAT-011 | When the batch job completes, display a **results summary**: total processed, succeeded, failed. Each URL row shows its final status. Successful rows show the product title; failed rows show the error message.                                                                                                                                                                                                                                                                   | US-BAT-01            |
| FR-BAT-012 | For STATIC_MODE: When "Start Scraping" is clicked, simulate a batch job. Iterate through the URLs, transitioning each from "pending" → "scraping" → "success" with 300ms delays. Show the progress animation. At the end, show a mock summary. No API calls.                                                                                                                                                                                                                        | US-BAT-04            |
| FR-BAT-013 | Add CLI subcommand: `harvest batch <file>`. Uses `parseUrlFile` from `src/lib/url-parser.ts` to read URLs from the file. Runs them through `runScrapeJob`. Prints a summary (succeeded/failed/elapsed). Register this command in `src/cli/index.ts`. Create `src/cli/commands/batch.ts`.                                                                                                                                                                                            | US-BAT-05            |
| FR-BAT-014 | The in-memory batch job map should limit stored jobs to the most recent 100. When the 101st job is created, evict the oldest. This prevents memory leaks for long-running servers.                                                                                                                                                                                                                                                                                                  | US-BAT-03            |

### 3.4 Feature 4: Email/Webhook Alerts

| ID         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Traces To            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------- | --------- |
| FR-ALR-001 | Add sidebar nav item: "🔔 Alerts" button with `onclick="showPage('alerts')"`. Place it between "Batch Import" and "Live Feed".                                                                                                                                                                                                                                                                                                                                                                                                                            | US-ALR-01            |
| FR-ALR-002 | Add a new "Alerts" page section in `dashboard/index.html` (`<div id="page-alerts">`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | US-ALR-01            |
| FR-ALR-003 | The Alerts page contains an **alert creation form** with fields: product URL (text input or dropdown), domain filter (optional text input), threshold percentage (number input, min 1, max 99, default 10), webhook URL (text input, optional), email address (text input, optional). At least one of webhook URL or email must be provided. "Create Alert" submit button.                                                                                                                                                                                | US-ALR-01            |
| FR-ALR-004 | The Alerts page contains an **active alerts table** showing: product/domain, threshold %, alert method (webhook/email/both), created date, and a "Delete" button per row.                                                                                                                                                                                                                                                                                                                                                                                 | US-ALR-01, US-ALR-05 |
| FR-ALR-005 | The Alerts page contains an **alert history table** below the active alerts table. Shows: triggered timestamp, product title, old price → new price, change %, delivery method, delivery status.                                                                                                                                                                                                                                                                                                                                                          | US-ALR-04            |
| FR-ALR-006 | Add API endpoint `GET /api/alerts`. Returns `{ alerts: Alert[] }` from the JSON file store. Add Swagger annotations.                                                                                                                                                                                                                                                                                                                                                                                                                                      | US-ALR-01            |
| FR-ALR-007 | Add API endpoint `POST /api/alerts`. Request body: `{ productUrl?, domain?, threshold, webhookUrl?, email? }`. Validates that threshold is 1-99 and at least one of webhookUrl or email is provided. Creates alert with nanoid ID and stores in `data/store/alerts.json`. Returns `{ alert: Alert }` (HTTP 201). Add Swagger annotations.                                                                                                                                                                                                                 | US-ALR-01            |
| FR-ALR-008 | Add API endpoint `DELETE /api/alerts/:id`. Removes the alert from `alerts.json`. Returns `{ ok: true }` or 404. Add Swagger annotations.                                                                                                                                                                                                                                                                                                                                                                                                                  | US-ALR-05            |
| FR-ALR-009 | Add API endpoint `GET /api/alerts/history`. Returns `{ history: AlertHistoryEntry[] }` sorted by `triggeredAt` descending, limited to the most recent 100 entries. Add Swagger annotations.                                                                                                                                                                                                                                                                                                                                                               | US-ALR-04            |
| FR-ALR-010 | Create `src/alerts/alert-manager.ts`. Provides functions: `loadAlerts()`, `saveAlert(alert)`, `deleteAlert(id)`, `loadAlertHistory()`, `appendAlertHistory(entry)`. Stores data in `data/store/alerts.json` (separate from the main `default.json` store). File structure: `{ alerts: Alert[], history: AlertHistoryEntry[] }`.                                                                                                                                                                                                                           | US-ALR-01, US-ALR-04 |
| FR-ALR-011 | Create `src/alerts/alert-checker.ts`. Export function `checkAlerts(product: Product, previousProduct: Product): Promise<void>`. Compares `product.price` to `previousProduct.price`. Calculates percentage change. For each matching alert (matching by `productUrl` exact match OR `domain` substring match on `product.sourceUrl`): if `                                                                                                                                                                                                                | changePercent        | >= alert.threshold` AND the change is a drop (newPrice < oldPrice), trigger the alert. | US-ALR-02 |
| FR-ALR-012 | Create `src/alerts/webhook-sender.ts`. Export function `sendWebhook(url: string, payload: AlertPayload): Promise<boolean>`. POSTs JSON to the URL with Content-Type: application/json. Returns true on 2xx response, false otherwise. Timeout: 10 seconds. Log successes and failures.                                                                                                                                                                                                                                                                    | US-ALR-02            |
| FR-ALR-013 | Create `src/alerts/email-sender.ts`. Export function `sendAlertEmail(to: string, payload: AlertPayload): Promise<boolean>`. Uses `nodemailer` to send via SMTP. SMTP config from env vars: `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (default "alerts@harvesthub.local"). Returns true on success, false otherwise. If SMTP env vars are not set, log a warning and return false without throwing.                                                                                                                    | US-ALR-03            |
| FR-ALR-014 | Install `nodemailer` as a dependency and `@types/nodemailer` as a devDependency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | US-ALR-03            |
| FR-ALR-015 | **Integration hook:** Modify `src/store/local-store.ts` `saveProducts()` function (or `src/core/job-runner.ts` `runScrapeJob()` function) to call `checkAlerts(newProduct, existingProduct)` when a product is updated and its price has changed. The existing `diffAndMerge` in `price-differ.ts` already detects price changes and returns a `PriceChange` object — use this information to trigger alert checking. The preferred integration point is in `saveProducts()` in `local-store.ts`, right after `diffAndMerge` detects a change (line ~70). | US-ALR-02            |
| FR-ALR-016 | Alert payload structure: `{ productTitle: string, productUrl: string, oldPrice: number, newPrice: number, changePercent: number, currency: string, triggeredAt: string }`.                                                                                                                                                                                                                                                                                                                                                                                | US-ALR-02            |
| FR-ALR-017 | For STATIC_MODE: Add mock alerts (3-5) and mock alert history (5-8 entries) to `MOCK_DATA` in `dashboard/index.html`. The `getMockData` function should handle `/api/alerts` and `/api/alerts/history` paths. The "Create Alert" and "Delete" buttons show a notice: "Alert management requires the local server."                                                                                                                                                                                                                                        | US-ALR-06            |
| FR-ALR-018 | Domain-based alerts: If `alert.domain` is set (e.g., "amazon.com"), the alert matches ANY product from that domain. This is checked by testing if the product's `sourceUrl` contains the domain string.                                                                                                                                                                                                                                                                                                                                                   | US-ALR-02            |

---

## 4. Non-Functional Requirements

| ID      | Category            | Requirement                                                                                                                                                             |
| ------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-001 | **Performance**     | E2E tests complete in under 120 seconds total on CI (chromium only).                                                                                                    |
| NFR-002 | **Performance**     | Chart.js charts render within 500ms of data availability (≤1000 data points).                                                                                           |
| NFR-003 | **Performance**     | Batch import of 100 URLs returns the jobId within 200ms (processing is async).                                                                                          |
| NFR-004 | **Reliability**     | Webhook delivery failures do not crash the server or block the scrape pipeline. Failures are caught, logged, and recorded in alert history with status "failed".        |
| NFR-005 | **Reliability**     | SMTP configuration errors (wrong credentials, host unreachable) are caught gracefully. Email failures are logged and recorded in alert history with status "failed".    |
| NFR-006 | **Security**        | Webhook URLs are sent to as-is (no SSRF prevention required for v1 — out of scope). A warning comment should note this for future hardening.                            |
| NFR-007 | **Security**        | SMTP credentials are read exclusively from environment variables, never hardcoded or stored in JSON files.                                                              |
| NFR-008 | **Compatibility**   | All new code must be ESM (`import`/`export`), matching the existing `"type": "module"` package configuration.                                                           |
| NFR-009 | **Compatibility**   | All new TypeScript must pass `tsc --noEmit` with the existing strict config (strict: true, noUncheckedIndexedAccess: true).                                             |
| NFR-010 | **Compatibility**   | The dashboard remains a standalone HTML file (no build step). All new JS is inline `<script>` in `index.html`. Chart.js is loaded via CDN.                              |
| NFR-011 | **Maintainability** | All new API endpoints include Swagger/OpenAPI JSDoc annotations following the existing pattern in `server.ts`.                                                          |
| NFR-012 | **Maintainability** | E2E tests use Page Object Model or well-named helper functions to avoid brittleness. Selectors prefer `id` attributes over CSS class selectors.                         |
| NFR-013 | **Testability**     | All alert module functions (`alert-manager`, `alert-checker`, `webhook-sender`, `email-sender`) are unit-testable (no hard-coded dependencies; accept injected params). |
| NFR-014 | **Accessibility**   | New dashboard sections include appropriate `aria-label` attributes on interactive elements (buttons, inputs, dropdowns).                                                |

---

## 5. Key Entities & Data Model

### 5.1 Existing Entities (unchanged)

| Entity          | Location                   | Key Fields                                                                  |
| --------------- | -------------------------- | --------------------------------------------------------------------------- |
| **Product**     | `src/types/product.ts`     | id, sourceUrl, title, price, currency, priceHistory, overallConfidence, ... |
| **ScrapeJob**   | `src/types/job.ts`         | id, status, totalUrls, completedUrls, failedUrls, tasks, config             |
| **Schedule**    | `src/types/schedule.ts`    | id, name, cronExpression, urlSource, config, enabled                        |
| **PriceChange** | `src/core/price-differ.ts` | productId, url, title, oldPrice, newPrice, delta, pctChange, detectedAt     |
| **StoreData**   | `src/store/local-store.ts` | products[], jobs[], schedules[], version                                    |

### 5.2 New Entities

#### BatchJob (in-memory only — not persisted)

```
BatchJob {
  jobId: string              // nanoid
  status: "queued" | "running" | "completed" | "failed"
  createdAt: string          // ISO timestamp
  totalUrls: number
  completedUrls: number
  failedUrls: number
  results: BatchResult[]
}

BatchResult {
  url: string
  status: "pending" | "scraping" | "success" | "failed"
  productTitle: string | null
  error: string | null
}
```

#### Alert (persisted to `data/store/alerts.json`)

```
Alert {
  id: string                 // nanoid
  productUrl: string | null  // specific product URL to monitor (optional)
  domain: string | null      // domain to monitor (optional) — e.g., "amazon.com"
  threshold: number          // percentage (1-99)
  webhookUrl: string | null  // webhook endpoint (optional)
  email: string | null       // email address (optional)
  createdAt: string          // ISO timestamp
}
```

**Constraint:** At least one of `productUrl` or `domain` must be set. At least one of `webhookUrl` or `email` must be set.

#### AlertHistoryEntry (persisted to `data/store/alerts.json`)

```
AlertHistoryEntry {
  id: string                 // nanoid
  alertId: string            // references Alert.id
  productTitle: string
  productUrl: string
  oldPrice: number
  newPrice: number
  changePercent: number
  currency: string
  triggeredAt: string        // ISO timestamp
  deliveryMethod: "webhook" | "email" | "both"
  deliveryStatus: "sent" | "partial" | "failed"
}
```

#### AlertPayload (transient — webhook/email body)

```
AlertPayload {
  productTitle: string
  productUrl: string
  oldPrice: number
  newPrice: number
  changePercent: number
  currency: string
  triggeredAt: string
}
```

#### Alerts JSON File Structure (`data/store/alerts.json`)

```
{
  "alerts": Alert[],
  "history": AlertHistoryEntry[]
}
```

#### Price Distribution Bucket (API response only)

```
PriceBucket {
  bucket: string     // e.g., "$0–50", "$50–100"
  min: number
  max: number
  count: number
}
```

---

## 6. Success Criteria

| ID     | Criterion                                                                                    | Measurement                                                                               |
| ------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| SC-001 | All 10+ E2E Playwright tests pass when run against the Express server with seeded data.      | `npm run test:e2e` exits with code 0.                                                     |
| SC-002 | E2E tests pass in CI (GitHub Actions) on both Node 20.x and 22.x.                            | CI workflow green on PR.                                                                  |
| SC-003 | The "Price Intelligence" dashboard page renders line chart and bar chart with real API data. | Manual verification: select a product, chart renders with correct data.                   |
| SC-004 | Price charts render correctly in STATIC_MODE on GitHub Pages.                                | Deploy to Pages, navigate to Price Intelligence, charts visible with mock data.           |
| SC-005 | Batch Import: pasting 5 URLs and clicking "Start Scraping" creates a job and shows progress. | Manual test: paste URLs, progress bar advances, summary shown at completion.              |
| SC-006 | Batch Import: uploading a .txt file populates the textarea with parsed URLs.                 | Manual test: upload file, URLs appear, validation runs.                                   |
| SC-007 | `POST /api/batch` returns a jobId within 200ms, `GET /api/batch/:jobId` returns job status.  | API testing via curl/Postman.                                                             |
| SC-008 | Alert webhook fires when a product's price drops ≥ threshold.                                | Unit test: mock webhook endpoint receives POST with correct payload.                      |
| SC-009 | Alert email sends when configured and SMTP vars are present.                                 | Unit test: nodemailer `sendMail` is called with correct arguments.                        |
| SC-010 | All existing 111 vitest tests still pass (zero regressions).                                 | `npm test` exits with code 0, same test count or higher.                                  |
| SC-011 | `tsc --noEmit` reports 0 errors (zero type regressions).                                     | `npx tsc --noEmit` exits with code 0.                                                     |
| SC-012 | New API endpoints appear in Swagger docs at `/api-docs`.                                     | Navigate to `/api-docs`, all new endpoints listed with correct schemas.                   |
| SC-013 | New sidebar nav items appear and navigate correctly.                                         | Visual check: "📊 Price Intelligence", "📥 Batch Import", "🔔 Alerts" visible in sidebar. |
| SC-014 | `harvest batch urls.txt` CLI command works end-to-end.                                       | Run command with a test file, observe scraping output and summary.                        |
| SC-015 | Alerts page shows mock data in STATIC_MODE.                                                  | Deploy to Pages, navigate to Alerts, mock alerts and history visible.                     |

---

## 7. Edge Cases & Error Handling

### 7.1 E2E Tests

| Edge Case                           | Expected Behavior                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Server fails to start (port in use) | Playwright `webServer` throws with a clear error. Test suite fails immediately with reason.                        |
| Store is empty (no products seeded) | The `beforeAll` global setup guarantees seeded data. If setup fails, all tests fail with setup error.              |
| Test fails and needs screenshot     | Playwright config `screenshot: "only-on-failure"` saves PNG to `e2e/screenshots/`. CI uploads this as an artifact. |
| Dashboard loads but API errors      | Dashboard shows error state (empty table, "—" values). Tests can assert the error state rather than hang.          |

### 7.2 Price Charts

| Edge Case                                                   | Expected Behavior                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Product with no priceHistory (empty array)                  | Line chart shows a single data point (current price). Inform user: "No historical data yet." |
| Product with only 1 price history entry                     | Line chart shows 2 points: the history entry + current price.                                |
| All products have price 0                                   | Price distribution chart shows all products in the "$0–50" bucket.                           |
| Time range filter shows no data (all history older than 7d) | Chart shows only the current price point. Message: "No data in selected range."              |
| Very large price values (>$100,000)                         | Y-axis auto-scales. No formatting errors (use toLocaleString).                               |
| STATIC_MODE mock data has inconsistent dates                | Ensure mock priceHistory dates are realistic and sorted chronologically.                     |

### 7.3 Batch Import

| Edge Case                                      | Expected Behavior                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Empty textarea (no URLs)                       | "Start Scraping" button is disabled.                                                                                           |
| All URLs invalid                               | All lines show red ✗. "Start Scraping" button stays disabled. Button text shows "Scrape 0 URLs".                               |
| Duplicate URLs in textarea                     | Duplicates are detected and marked with a warning (not an error). The API deduplicates before processing.                      |
| Very large paste (>1000 URLs)                  | Display a warning: "Large batch. This may take a while." Process in API as normal.                                             |
| File upload with empty file                    | Textarea remains empty. Message: "No URLs found in file."                                                                      |
| File upload with binary/unsupported content    | Show error: "Could not parse file. Please use a plain text file."                                                              |
| Batch job polling: job not found (stale jobId) | `GET /api/batch/:jobId` returns 404. Client stops polling and shows message: "Job not found. It may have expired."             |
| Server restarts while batch is running         | In-memory batch jobs are lost. Client receives 404 on next poll. Client shows: "Job not found. The server may have restarted." |
| `POST /api/batch` with empty urls array        | Return 400: "At least one URL is required."                                                                                    |
| `POST /api/batch` with >500 URLs               | Return 400: "Maximum 500 URLs per batch." (prevent abuse)                                                                      |

### 7.4 Alerts

| Edge Case                                            | Expected Behavior                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Alert with neither webhookUrl nor email              | API returns 400: "At least one delivery method (webhookUrl or email) is required."                           |
| Alert with neither productUrl nor domain             | API returns 400: "At least one target (productUrl or domain) is required."                                   |
| Threshold = 0 or > 100                               | API returns 400: "Threshold must be between 1 and 99."                                                       |
| Webhook endpoint returns 500                         | `sendWebhook` returns false. Alert history records delivery status as "failed". Server does NOT retry (v1).  |
| Webhook endpoint is unreachable (DNS error, timeout) | `sendWebhook` catches the error, logs warning, returns false. History records "failed".                      |
| SMTP not configured (env vars missing)               | `sendAlertEmail` detects missing vars, logs warning, returns false. Does NOT throw.                          |
| SMTP auth fails                                      | `sendAlertEmail` catches error, logs warning, returns false. History records "failed".                       |
| Multiple alerts match the same product               | All matching alerts fire independently. Each gets its own history entry.                                     |
| Price increases (not drops) on a product with alert  | Alerts only trigger on price DROPS (newPrice < oldPrice). Increases are ignored.                             |
| Product price changes from $0 to some value          | Skip alert checking when oldPrice is 0 (prevents division-by-zero in percentage calc and false positives).   |
| alerts.json doesn't exist yet                        | `loadAlerts()` returns `{ alerts: [], history: [] }` (create default structure, like `local-store.ts` does). |
| Alert for a product that was deleted from store      | Alert remains configured but never fires. No error.                                                          |
| Delete alert that doesn't exist                      | API returns 404: "Alert not found."                                                                          |

---

## 8. Assumptions & Dependencies

### 8.1 Assumptions

| #   | Assumption                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | The Express server (`src/api/start.ts`) will be used to serve the dashboard during E2E tests. It starts on port 3000 by default (via `process.env.PORT`).                                                                                                                                                        |
| A2  | E2E tests can use the same `data/store/default.json` file since tests run in isolation (CI environments are ephemeral). For local dev, the globalSetup will seed and teardown will clean.                                                                                                                        |
| A3  | Chart.js 4.x CDN (`cdn.jsdelivr.net`) is accessible in all deployment environments. STATIC_MODE on GitHub Pages has internet access.                                                                                                                                                                             |
| A4  | The `POST /api/batch` endpoint uses the existing `runScrapeJob` from `job-runner.ts` which requires the Python engine. In E2E and unit tests, the actual scraping is not tested (Python engine may not be available in all CI configs). Batch tests focus on the API contract (jobId creation, status tracking). |
| A5  | Alerts only trigger on price **drops** (not increases). This is the most common use case. Increase alerts can be added in a future version.                                                                                                                                                                      |
| A6  | The `multer` package will be added as a dependency for `POST /api/batch/upload` multipart file parsing. This is a lightweight, well-maintained package.                                                                                                                                                          |
| A7  | `nodemailer` is added as a production dependency because email sending happens at runtime in the server process.                                                                                                                                                                                                 |
| A8  | The sidebar order after all features are added will be: Dashboard, Products, Exports, 📊 Price Intelligence, 📥 Batch Import, 🔔 Alerts, Live Feed, Schedules, (external links).                                                                                                                                 |

### 8.2 Dependencies

| Dependency          | Type          | Purpose                                        |
| ------------------- | ------------- | ---------------------------------------------- |
| `@playwright/test`  | devDependency | E2E browser testing framework                  |
| `chart.js` (CDN)    | CDN script    | Dashboard price charts — NO npm install        |
| `multer`            | dependency    | Multipart file upload parsing for batch import |
| `@types/multer`     | devDependency | TypeScript types for multer                    |
| `nodemailer`        | dependency    | SMTP email sending for alerts                  |
| `@types/nodemailer` | devDependency | TypeScript types for nodemailer                |

### 8.3 Environment Variables (new)

| Variable    | Required | Default                   | Purpose              |
| ----------- | -------- | ------------------------- | -------------------- |
| `SMTP_HOST` | No       | —                         | SMTP server hostname |
| `SMTP_PORT` | No       | 587                       | SMTP server port     |
| `SMTP_USER` | No       | —                         | SMTP username        |
| `SMTP_PASS` | No       | —                         | SMTP password        |
| `SMTP_FROM` | No       | `alerts@harvesthub.local` | Sender email address |

---

## 9. Out of Scope

| Item                                                                                     | Reason                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Playwright tests for Arabic pages (`index-ar.html`, `docs-ar.html`, `marketing-ar.html`) | Focus on core English dashboard first                                                            |
| Playwright tests for WebSocket live feed                                                 | WS testing with Playwright is complex and fragile; the live feed is tested indirectly via vitest |
| Multi-browser E2E (Firefox, WebKit)                                                      | Start with Chromium only; can add later via Playwright projects                                  |
| Chart.js npm install / bundled build                                                     | Dashboard is a standalone HTML file; CDN is the correct approach                                 |
| Price increase alerts (only drops are monitored)                                         | V1 focuses on the most requested use case                                                        |
| SSRF prevention on webhook URLs                                                          | Security hardening item for V2                                                                   |
| Retry logic for failed webhook/email deliveries                                          | V1 logs failures; retry queues are a V2 feature                                                  |
| Batch job persistence across server restarts                                             | In-memory Map is sufficient for V1                                                               |
| Real-time WebSocket updates for batch progress                                           | V1 uses polling; WS can be added for V2                                                          |
| Dashboard notification toasts / snackbar system                                          | Use `alert()` and inline messages for V1                                                         |
| Rate limiting on new API endpoints                                                       | Rely on existing rate limiting infrastructure                                                    |
| Authentication/authorization on alert endpoints                                          | No auth exists in the current API; this is a platform-level concern                              |
| Migration of existing mock data format                                                   | Existing mock data is extended, not replaced                                                     |

---

## 10. File-Level Implementation Map

### 10.1 New Files to Create

| File Path                              | Feature | Purpose                                                                |
| -------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `playwright.config.ts`                 | E2E     | Playwright configuration (baseURL, webServer, screenshots)             |
| `e2e/dashboard.spec.ts`                | E2E     | Main E2E test suite (US-E2E-01 thru US-E2E-06)                         |
| `e2e/navigation.spec.ts`               | E2E     | Sidebar nav, theme toggle, responsive tests (US-E2E-06 thru US-E2E-10) |
| `e2e/global-setup.ts`                  | E2E     | Seeds store with test products before E2E suite                        |
| `e2e/global-teardown.ts`               | E2E     | Cleans store after E2E suite                                           |
| `e2e/fixtures.ts`                      | E2E     | Shared test product factory function, helper utilities                 |
| `e2e/tsconfig.json`                    | E2E     | TypeScript config extending root for e2e dir                           |
| `src/cli/commands/batch.ts`            | Batch   | CLI `harvest batch <file>` command                                     |
| `src/alerts/alert-manager.ts`          | Alerts  | Alert CRUD + history persistence to `data/store/alerts.json`           |
| `src/alerts/alert-checker.ts`          | Alerts  | Price-drop detection + alert matching logic                            |
| `src/alerts/webhook-sender.ts`         | Alerts  | HTTP POST to webhook URLs                                              |
| `src/alerts/email-sender.ts`           | Alerts  | SMTP email sending via nodemailer                                      |
| `src/alerts/types.ts`                  | Alerts  | Alert, AlertHistoryEntry, AlertPayload type definitions                |
| `src/__tests__/alert-manager.test.ts`  | Alerts  | Unit tests for alert CRUD operations                                   |
| `src/__tests__/alert-checker.test.ts`  | Alerts  | Unit tests for price-drop matching logic                               |
| `src/__tests__/webhook-sender.test.ts` | Alerts  | Unit tests for webhook delivery                                        |
| `src/__tests__/batch-api.test.ts`      | Batch   | Unit tests for batch API endpoints                                     |

### 10.2 Existing Files to Modify

| File Path                  | Feature               | Changes                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`             | E2E, Batch, Alerts    | Add devDependencies (`@playwright/test`, `@types/multer`, `@types/nodemailer`), dependencies (`multer`, `nodemailer`), add `"test:e2e"` script                                                                                                                                                                                                                              |
| `tsconfig.json`            | E2E                   | Either add `"e2e/**/*"` to `include` OR create separate `e2e/tsconfig.json` (preferred)                                                                                                                                                                                                                                                                                     |
| `.github/workflows/ci.yml` | E2E                   | Add Playwright browser install step, add Playwright test step after vitest, add screenshot artifact upload on failure                                                                                                                                                                                                                                                       |
| `dashboard/index.html`     | Charts, Batch, Alerts | Add Chart.js CDN script tag; add 3 new page sections (#page-price-intel, #page-batch, #page-alerts); add 3 sidebar nav items; extend MOCK_PRODUCTS priceHistory; extend MOCK_DATA with mock analytics/batch/alerts data; extend getMockData with new paths; add all new JavaScript functions for charts, batch UI, and alerts UI                                            |
| `src/api/server.ts`        | Charts, Batch, Alerts | Add new API endpoints: `GET /api/analytics/price-distribution`, `GET /api/analytics/price-changes`, `POST /api/batch`, `GET /api/batch/:jobId`, `POST /api/batch/upload`, `GET /api/alerts`, `POST /api/alerts`, `DELETE /api/alerts/:id`, `GET /api/alerts/history`. Import multer for file upload. Import alert functions. Add Swagger annotations for all new endpoints. |
| `src/store/local-store.ts` | Alerts                | Import and call `checkAlerts` in `saveProducts()` after `diffAndMerge` detects a price change (around line 70).                                                                                                                                                                                                                                                             |
| `src/cli/index.ts`         | Batch                 | Import and register `batchCommand` from `./commands/batch.js`.                                                                                                                                                                                                                                                                                                              |

### 10.3 New Directories to Create

| Directory          | Purpose                          |
| ------------------ | -------------------------------- |
| `e2e/`             | Playwright test files            |
| `e2e/screenshots/` | Failure screenshots (gitignored) |
| `src/alerts/`      | Alert management module          |

---

## 11. Acceptance Checklist

### Spec Self-Validation

- [x] No implementation details (languages/frameworks mentioned only as context for existing codebase)
- [x] All requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Zero `[NEEDS CLARIFICATION]` markers remain (all decisions made with informed defaults)
- [x] Every user story has acceptance scenarios (Given/When/Then)
- [x] Edge cases identified for every major flow
- [x] Scope is clearly bounded (in-scope AND out-of-scope documented)
- [x] All functional requirements trace to at least one user story

### Implementation Acceptance Checklist

| #   | Check                                                                                                    | Status |
| --- | -------------------------------------------------------------------------------------------------------- | ------ |
| 1   | `npm test` — all existing vitest tests still pass (111+)                                                 | ☐      |
| 2   | `npx tsc --noEmit` — zero TypeScript errors                                                              | ☐      |
| 3   | `npm run test:e2e` — all Playwright tests pass (10+)                                                     | ☐      |
| 4   | Dashboard: 3 new sidebar nav items visible (Price Intelligence, Batch Import, Alerts)                    | ☐      |
| 5   | Dashboard: Price Intelligence page renders line chart + bar chart                                        | ☐      |
| 6   | Dashboard: Batch Import textarea, file upload, validation, progress all work                             | ☐      |
| 7   | Dashboard: Alerts creation form, alerts table, history table all work                                    | ☐      |
| 8   | All pages work in STATIC_MODE with mock data (deploy to GitHub Pages to verify)                          | ☐      |
| 9   | API: `GET /api/analytics/price-distribution` returns bucket data                                         | ☐      |
| 10  | API: `GET /api/analytics/price-changes` returns drops and increases                                      | ☐      |
| 11  | API: `POST /api/batch` returns jobId, `GET /api/batch/:jobId` returns status                             | ☐      |
| 12  | API: `POST /api/batch/upload` parses URLs from uploaded file                                             | ☐      |
| 13  | API: `GET /api/alerts`, `POST /api/alerts`, `DELETE /api/alerts/:id`, `GET /api/alerts/history` all work | ☐      |
| 14  | All new endpoints have Swagger annotations visible at `/api-docs`                                        | ☐      |
| 15  | CLI: `harvest batch <file>` command works                                                                | ☐      |
| 16  | CI: `.github/workflows/ci.yml` includes Playwright step                                                  | ☐      |
| 17  | Alert webhook fires on price drop ≥ threshold (unit test)                                                | ☐      |
| 18  | Alert email sends via nodemailer when SMTP configured (unit test)                                        | ☐      |
| 19  | `data/store/alerts.json` is created/read/updated correctly                                               | ☐      |
| 20  | `e2e/screenshots/` is gitignored                                                                         | ☐      |
| 21  | No regressions in existing dashboard pages (Dashboard, Products, Exports, Live Feed, Schedules)          | ☐      |

---

## Appendix A: Sidebar Navigation Order (After Implementation)

```
🌾 HarvestHub
─────────────────
📊 Dashboard          ← existing
📦 Products           ← existing
📄 Exports            ← existing
📊 Price Intelligence ← NEW (Feature 2)
📥 Batch Import       ← NEW (Feature 3)
🔔 Alerts             ← NEW (Feature 4)
☀️ Live Feed           ← existing
📅 Schedules          ← existing
─────────────────
📡 API Docs           ← existing (external link)
📄 Documentation      ← existing (link)
🚀 Marketing          ← existing (link)
🌐 عربي              ← existing (link)
─────────────────
GitHub               ← existing (bottom)
[Engine Status]      ← existing (bottom)
[Theme Toggle]       ← existing (bottom)
```

## Appendix B: API Endpoint Summary (New)

| Method   | Path                                | Feature | Returns                                                              |
| -------- | ----------------------------------- | ------- | -------------------------------------------------------------------- |
| `GET`    | `/api/analytics/price-distribution` | Charts  | `{ buckets: PriceBucket[] }`                                         |
| `GET`    | `/api/analytics/price-changes`      | Charts  | `{ drops: PriceChange[], increases: PriceChange[] }`                 |
| `POST`   | `/api/batch`                        | Batch   | `{ jobId: string }` (202 Accepted)                                   |
| `GET`    | `/api/batch/:jobId`                 | Batch   | `{ jobId, status, totalUrls, completedUrls, failedUrls, results[] }` |
| `POST`   | `/api/batch/upload`                 | Batch   | `{ urls: string[], invalid: string[] }`                              |
| `GET`    | `/api/alerts`                       | Alerts  | `{ alerts: Alert[] }`                                                |
| `POST`   | `/api/alerts`                       | Alerts  | `{ alert: Alert }` (201 Created)                                     |
| `DELETE` | `/api/alerts/:id`                   | Alerts  | `{ ok: true }`                                                       |
| `GET`    | `/api/alerts/history`               | Alerts  | `{ history: AlertHistoryEntry[] }`                                   |

## Appendix C: Mock Data Additions for STATIC_MODE

The `getMockData` function in `dashboard/index.html` needs to handle these new paths:

| Path                                | Mock Response                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/analytics/price-distribution` | 6 buckets with realistic counts summing to ~147 (matching existing mock totalProducts)                                                                        |
| `/api/analytics/price-changes`      | drops: 5 products (e.g., Bosch drill $129.99→$3.99 = -97%, Sony headphones $399→$348 = -12.8%), increases: 3 products (e.g., Echo Dot $29.99→$49.99 = +66.7%) |
| `/api/products/:id/history`         | Return the product's priceHistory from MOCK_PRODUCTS (already partially supported — needs enhanced data)                                                      |
| `/api/alerts`                       | 3-5 mock alerts with varied thresholds and methods                                                                                                            |
| `/api/alerts/history`               | 5-8 mock triggered alert entries with timestamps from the past week                                                                                           |
| `/api/batch`                        | Not needed in STATIC_MODE (simulated client-side)                                                                                                             |
| `/api/batch/:jobId`                 | Not needed in STATIC_MODE (simulated client-side)                                                                                                             |

---

_End of Specification_
