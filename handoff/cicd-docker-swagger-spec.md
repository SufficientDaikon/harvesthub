# HarvestHub — CI/CD Pipeline, Docker Container & Swagger/OpenAPI Spec

> **Spec ID:** HHUB-CICD-DOCKER-SWAGGER-001
> **Version:** 1.0.0
> **Created:** 2025-01-27
> **Status:** Ready for Implementation
> **Repository:** SufficientDaikon/harvesthub (branch: master)
> **Project Root:** h:\scraper

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
10. [Implementation Guide](#10-implementation-guide)
11. [Acceptance Checklist](#11-acceptance-checklist)

---

## 1. Project Overview

### What We're Building

Three infrastructure and developer-experience features for HarvestHub, an existing TypeScript+Python hybrid web scraping platform:

1. **CI/CD Pipeline** — Automated GitHub Actions workflow that validates every push and PR with type-checking and tests across multiple Node versions.
2. **Docker Container** — A multi-stage Docker build that packages the entire TypeScript API + Python scraping engine into a single, portable container.
3. **Swagger/OpenAPI Documentation** — Interactive API documentation served at `/api-docs`, generated from JSDoc annotations on each Express route.

### Why

- **CI/CD**: The project has 111 tests but no automated gating. Regressions can reach master undetected.
- **Docker**: Users must manually install Node 23 + Python 3.13 + pip dependencies. Docker provides one-command deployment.
- **Swagger**: The API has 10 endpoints documented only in README prose. Developers need interactive, try-it-out documentation with schemas.

### For Whom

| Audience | Value |
|----------|-------|
| **Contributors** | CI catches regressions before merge; Docker removes "works on my machine" |
| **API consumers** | Swagger provides interactive docs, schemas, and example responses |
| **Ops/DevOps** | Docker + Compose enables reproducible deployments anywhere |
| **Maintainers** | CI badge signals project health; Swagger badge signals API maturity |

### Current State Summary

| Aspect | Current |
|--------|---------|
| Runtime | Node v23.7.0, Python 3.13, Windows dev |
| Build | `tsc` → `dist/` (ESM, target ES2022, rootDir `.`, outDir `dist`) |
| Entry point | `dist/cli/index.js` (CLI), `src/api/server.ts` (API, Express on configurable port, default 3000) |
| Tests | 111 passing (vitest run), 14 test files in `src/__tests__/` |
| Type check | `tsc --noEmit` (aliased as `npm run lint`) |
| Python engine | `engine/scraper.py` — stdin/stdout JSON IPC, deps: scrapling≥0.2, orjson≥3.9 |
| Python extras needed at runtime | scrapling, curl_cffi, orjson, browserforge |
| Existing CI | `.github/workflows/pages.yml` (GitHub Pages deploy for dashboard only, triggers on `dashboard/**` changes) |
| Package type | ESM (`"type": "module"` in package.json) |
| API port | Configurable; CLI command uses `-p 4000`; `createServer(port = 3000)` default |
| Data persistence | `data/store/` (JSON files), `data/exports/` (generated exports) |
| Dashboard | Static HTML files in `dashboard/` served by Express static middleware |
| Dependencies | express, zod, nanoid, croner, exceljs, ws, pino, commander, chalk, cli-progress, ora |
| DevDependencies | typescript, vitest, tsx, @types/* |

---

## 2. User Scenarios & Stories

### Feature 1: CI/CD Pipeline

#### US-CI-01 — Automated validation on push (P1)

> As a **contributor**, I want every push to master to automatically run type-checking and tests, so regressions are caught before they affect other developers.

**Acceptance Scenarios:**

```gherkin
Scenario: Push to master triggers CI
  Given a commit is pushed to the master branch
  When GitHub Actions processes the push event
  Then the CI workflow runs type-checking (tsc --noEmit)
  And the CI workflow runs all tests (vitest run)
  And both steps execute on Node 20.x and Node 22.x
  And Python 3.12 is available for integration tests

Scenario: CI passes on clean codebase
  Given the current codebase has 0 TS errors and 111 passing tests
  When the CI workflow runs
  Then all matrix jobs pass (2/2 green)

Scenario: CI fails on type error
  Given a commit introduces a TypeScript type error
  When the CI workflow runs
  Then the tsc --noEmit step fails
  And the workflow is marked as failed
```

#### US-CI-02 — PR validation gate (P1)

> As a **maintainer**, I want pull requests to be validated before merge, so I can enforce code quality.

**Acceptance Scenarios:**

```gherkin
Scenario: Pull request triggers CI
  Given a pull request is opened targeting any branch
  When GitHub Actions processes the PR event
  Then the same CI workflow runs with the full matrix

Scenario: PR with failing tests shows red status
  Given a PR introduces a test failure
  When the CI workflow completes
  Then the PR shows a failing check status
```

#### US-CI-03 — CI status badge in README (P2)

> As a **visitor**, I want to see the CI status at a glance in the README, so I know the project is actively tested.

**Acceptance Scenarios:**

```gherkin
Scenario: Badge renders in README
  Given the README.md is viewed on GitHub
  Then a CI status badge is visible in the badge row
  And it links to the Actions workflow runs page
  And it shows "passing" or "failing" dynamically
```

---

### Feature 2: Docker Container

#### US-DK-01 — One-command deployment (P1)

> As a **user**, I want to run `docker compose up` and have the entire platform running, so I don't need to install Node, Python, or any dependencies manually.

**Acceptance Scenarios:**

```gherkin
Scenario: Docker Compose starts the platform
  Given Docker and Docker Compose are installed
  When the user runs "docker compose up --build" in the project root
  Then the container builds successfully
  And the API server starts on port 4000
  And GET http://localhost:4000/api/status returns a 200 response
  And the Python scraping engine is available (engine field is "ready" or at minimum does not crash)

Scenario: Data persists across container restarts
  Given the platform has scraped products
  When the container is stopped and restarted
  Then previously scraped products are still available via the API
  Because the ./data volume is mounted to /app/data
```

#### US-DK-02 — Docker build works standalone (P1)

> As a **DevOps engineer**, I want to build and run the Docker image independently from Compose, for integration into custom orchestration.

**Acceptance Scenarios:**

```gherkin
Scenario: Standalone Docker build
  Given the Dockerfile is at the project root
  When the user runs "docker build -t harvesthub ."
  Then the build completes without errors
  And "docker run -p 4000:4000 harvesthub" starts the API

Scenario: Container health check passes
  Given the container is running
  When the Docker health check executes
  Then it curls localhost:4000/api/status and receives HTTP 200
```

#### US-DK-03 — Docker instructions in README (P2)

> As a **user**, I want Docker deployment instructions in the README, so I know how to use containers.

**Acceptance Scenarios:**

```gherkin
Scenario: README contains Docker section
  Given the README.md is read
  Then there is a "Docker" section under "Deployment"
  And it shows the docker compose up command
  And it shows the standalone docker build/run commands
  And it mentions the data volume mount
```

---

### Feature 3: Swagger/OpenAPI Documentation

#### US-SW-01 — Interactive API documentation (P1)

> As an **API consumer**, I want to browse interactive API documentation at `/api-docs`, so I can understand all endpoints without reading source code.

**Acceptance Scenarios:**

```gherkin
Scenario: Swagger UI loads
  Given the API server is running
  When the user navigates to http://localhost:4000/api-docs
  Then the Swagger UI renders
  And it displays "HarvestHub API" as the title
  And version "1.0.0" is shown
  And all 10 API endpoints are documented

Scenario: Try-it-out works
  Given Swagger UI is loaded
  When the user clicks "Try it out" on GET /api/status
  And clicks "Execute"
  Then a real API response is displayed
```

#### US-SW-02 — Complete endpoint documentation (P1)

> As a **developer**, I want every endpoint to have documented request parameters, response schemas, and error responses, so I can integrate without guessing.

**Acceptance Scenarios:**

```gherkin
Scenario: GET /api/products documentation is complete
  Given the Swagger UI is loaded
  When the user expands GET /api/products
  Then query parameters are listed: search, domain, brand, availability, minPrice, maxPrice, minConfidence, page, limit, sortBy, sortOrder
  And the 200 response schema shows: products array, total, page, limit, totalPages
  And a 500 error response is documented

Scenario: POST /api/schedules documentation includes request body
  Given the Swagger UI is loaded
  When the user expands POST /api/schedules
  Then the request body schema shows: name (required), cronExpression (required), urlSource (required), config (optional), enabled (optional)
  And a 201 response with schedule object is documented
  And a 400 response for missing fields is documented
```

#### US-SW-03 — Dashboard links to API docs (P2)

> As a **dashboard user**, I want a link to the API docs from the dashboard sidebar and the docs page, so I can easily discover the API reference.

**Acceptance Scenarios:**

```gherkin
Scenario: Dashboard sidebar has API Docs link
  Given the dashboard is loaded at http://localhost:4000
  Then the sidebar contains an "API Docs" nav item
  And clicking it navigates to /api-docs

Scenario: Docs page has API Docs link
  Given the docs page is loaded at http://localhost:4000/docs
  Then the navigation bar contains an "API Docs" link
  And clicking it navigates to /api-docs
```

#### US-SW-04 — Swagger badge in README (P2)

> As a **visitor**, I want to see a Swagger badge in the README, so I know the API is documented.

**Acceptance Scenarios:**

```gherkin
Scenario: Swagger badge in README
  Given the README.md is viewed
  Then a Swagger badge is visible in the badge row
  And it is labeled "Swagger" or "API Docs"
```

---

## 3. Functional Requirements

### Feature 1: CI/CD Pipeline

| ID | Requirement | Traces To |
|----|-------------|-----------|
| FR-CI-001 | Create `.github/workflows/ci.yml` that triggers on `push` to `master` and on all `pull_request` events | US-CI-01, US-CI-02 |
| FR-CI-002 | Define a job matrix with Node.js versions `20.x` and `22.x` | US-CI-01 |
| FR-CI-003 | Workflow steps in order: (1) checkout, (2) setup Node, (3) cache node_modules, (4) install npm deps, (5) setup Python 3.12, (6) cache pip packages, (7) install Python deps, (8) run `tsc --noEmit`, (9) run `vitest run` | US-CI-01, US-CI-02 |
| FR-CI-004 | Cache `node_modules` using `actions/cache` keyed on `package-lock.json` hash | US-CI-01 |
| FR-CI-005 | Cache pip packages (cache the pip cache directory) keyed on `engine/requirements.txt` hash | US-CI-01 |
| FR-CI-006 | Install Python packages: `pip install scrapling curl_cffi orjson browserforge` | US-CI-01 |
| FR-CI-007 | Add CI status badge to the top of README.md in the existing badge row. Badge format: `[![CI](https://github.com/SufficientDaikon/harvesthub/actions/workflows/ci.yml/badge.svg)](https://github.com/SufficientDaikon/harvesthub/actions/workflows/ci.yml)` | US-CI-03 |
| FR-CI-008 | The existing `.github/workflows/pages.yml` must NOT be modified | US-CI-01 |
| FR-CI-009 | The workflow must run on `ubuntu-latest` | US-CI-01 |

### Feature 2: Docker Container

| ID | Requirement | Traces To |
|----|-------------|-----------|
| FR-DK-001 | Create `Dockerfile` at project root with multi-stage build | US-DK-01, US-DK-02 |
| FR-DK-002 | Stage 1 (builder): Use `node:20-alpine` base, copy `package.json` + `package-lock.json`, run `npm ci`, copy source files, run `npm run build` (tsc) | US-DK-01 |
| FR-DK-003 | Stage 2 (runtime): Use `node:20-alpine` base, install Python 3.12 (via `apk add python3 py3-pip`), copy compiled `dist/` from builder, copy `engine/` directory, copy `dashboard/` directory, copy `package.json` + `package-lock.json`, run `npm ci --omit=dev` for production deps only, install Python deps (`pip install scrapling curl_cffi orjson browserforge`) | US-DK-01 |
| FR-DK-004 | Runtime stage exposes port 4000 (`EXPOSE 4000`) | US-DK-01 |
| FR-DK-005 | Runtime stage sets `ENV NODE_ENV=production` and `ENV PORT=4000` | US-DK-01 |
| FR-DK-006 | Runtime CMD starts the API server: `node dist/cli/index.js dashboard -p 4000` | US-DK-01 |
| FR-DK-007 | Create `docker-compose.yml` at project root | US-DK-01 |
| FR-DK-008 | Compose service named `harvesthub`: builds from local Dockerfile, maps port `4000:4000`, mounts volume `./data:/app/data`, sets environment `NODE_ENV=production` and `PORT=4000` | US-DK-01 |
| FR-DK-009 | Compose healthcheck: `curl -f http://localhost:4000/api/status` with interval 30s, timeout 10s, retries 3, start_period 15s | US-DK-01 |
| FR-DK-010 | Create `.dockerignore` excluding: `node_modules`, `.git`, `.github`, `output`, `dist`, `*.xlsx`, `*.log`, `.env`, `processed-products*.xlsx`, `urls*.txt`, `test-urls.txt`, `sample-urls.txt` | US-DK-01 |
| FR-DK-011 | Add a "Docker" subsection to the README under the "Deployment" section with `docker compose up`, standalone build/run commands, and volume explanation | US-DK-03 |
| FR-DK-012 | The WORKDIR in the Dockerfile must be `/app` | US-DK-01 |
| FR-DK-013 | Create the `data/store` and `data/exports` directories in the Dockerfile so the app doesn't crash when no volume is mounted | US-DK-01 |

### Feature 3: Swagger/OpenAPI Documentation

| ID | Requirement | Traces To |
|----|-------------|-----------|
| FR-SW-001 | Install `swagger-jsdoc` and `swagger-ui-express` as production dependencies; install `@types/swagger-jsdoc` and `@types/swagger-ui-express` as dev dependencies | US-SW-01 |
| FR-SW-002 | Create an OpenAPI 3.0.0 specification object with: title "HarvestHub API", version "1.0.0", description "Adaptive product scraping platform API — extract, search, filter, export and schedule product data from any e-commerce site." | US-SW-01 |
| FR-SW-003 | Configure swagger-jsdoc to scan `src/api/server.ts` (or the compiled equivalent — see implementation notes) for JSDoc `@openapi` annotations | US-SW-01 |
| FR-SW-004 | Serve Swagger UI at `/api-docs` endpoint using `swagger-ui-express` middleware on the Express app | US-SW-01 |
| FR-SW-005 | Document `GET /api/status` — no parameters; response schema: `{ engine, userAgents, proxies, productCount, totalJobs, lastJob, uptime }`; error 500 | US-SW-02 |
| FR-SW-006 | Document `GET /api/products` — query params: search (string), domain (string), brand (string), availability (string, enum: in_stock/out_of_stock/pre_order/unknown), minPrice (number), maxPrice (number), minConfidence (number), page (integer, default 1), limit (integer, default 50, max 200), sortBy (string), sortOrder (string, enum: asc/desc); response schema: `{ products[], total, page, limit, totalPages }`; error 500 | US-SW-02 |
| FR-SW-007 | Document `GET /api/products/:id/history` — path param: id (string, required); response 200: `{ id, title, currentPrice, currency, priceHistory[] }`; error 404: `{ error: "Product not found" }`; error 500 | US-SW-02 |
| FR-SW-008 | Document `GET /api/stats` — no parameters; response schema: `{ totalProducts, inStock, outOfStock, avgPrice, avgConfidence, priceRange: { min, max }, topBrands[], topCategories[] }`; error 500 | US-SW-02 |
| FR-SW-009 | Document `GET /api/export/:format` — path param: format (string, required, enum: xlsx/csv/json/gmc); response 200: file download; error 400: `{ error: "Unsupported format..." }`; error 404: `{ error: "No products to export" }`; error 500 | US-SW-02 |
| FR-SW-010 | Document `GET /api/jobs` — no parameters; response: `{ jobs[] }` (last 20 jobs, reversed); error 500 | US-SW-02 |
| FR-SW-011 | Document `GET /api/schedules` — no parameters; response: `{ schedules[] }` (each with `running` boolean); error 500 | US-SW-02 |
| FR-SW-012 | Document `POST /api/schedules` — request body (JSON): name (string, required), cronExpression (string, required), urlSource (string, required), config (object, optional), enabled (boolean, optional, default true); response 201: `{ schedule }` with full Schedule object; error 400: `{ error: "name, cronExpression and urlSource are required" }`; error 500 | US-SW-02 |
| FR-SW-013 | Document `PATCH /api/schedules/:id` — path param: id; request body: partial Schedule fields; response 200: `{ schedule }`; error 404; error 500 | US-SW-02 |
| FR-SW-014 | Document `DELETE /api/schedules/:id` — path param: id; response 200: `{ ok: true }`; error 404; error 500 | US-SW-02 |
| FR-SW-015 | Add an "API Docs" nav item to the dashboard sidebar (`dashboard/index.html`) after the existing "Schedules" button and before the "Documentation" link. It should be an `<a>` tag linking to `/api-docs` with a 📡 or equivalent icon, styled consistently with existing nav items. | US-SW-03 |
| FR-SW-016 | Add an "API Docs" link to the docs page navigation (`dashboard/docs.html`) in the `.nav-links` div, before the "Dashboard" link. Link target: `/api-docs`. | US-SW-03 |
| FR-SW-017 | Add a Swagger/API Docs badge to README.md in the badge row: `[![API Docs](https://img.shields.io/badge/API_Docs-Swagger-85EA2D?logo=swagger&logoColor=black)](/api-docs)` | US-SW-04 |
| FR-SW-018 | Define reusable OpenAPI component schemas for: Product, Schedule, ScrapeJob, PriceHistoryEntry, StatsResponse, ErrorResponse. These schemas must reflect the actual TypeScript types in `src/types/`. | US-SW-02 |
| FR-SW-019 | Each documented endpoint must include at least one example response value | US-SW-02 |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | **Compatibility** | CI workflow must pass on the current codebase (0 TS errors, 111 tests) without any code changes beyond the three features |
| NFR-002 | **Performance** | CI workflow should complete in under 5 minutes per matrix job (using caching) |
| NFR-003 | **Performance** | Docker build should complete in under 10 minutes on a typical machine (leveraging layer caching) |
| NFR-004 | **Image Size** | Docker runtime image should be under 1GB (Alpine base helps) |
| NFR-005 | **Startup** | Container should pass health check within 15 seconds of start |
| NFR-006 | **Performance** | Swagger UI should load in under 2 seconds on localhost |
| NFR-007 | **Maintainability** | OpenAPI annotations should be co-located with route handlers (JSDoc in server.ts), not in a separate YAML file, so they stay in sync with code |
| NFR-008 | **Security** | Docker container should not run as root in the runtime stage (use a non-root user) |
| NFR-009 | **Backwards Compatibility** | All existing tests (111) must continue to pass after changes |
| NFR-010 | **Backwards Compatibility** | Existing pages.yml workflow must not be modified |
| NFR-011 | **Backwards Compatibility** | All existing API endpoints must continue to work identically |
| NFR-012 | **Portability** | Docker setup must work with both `docker compose` (v2) and `docker-compose` (v1) syntax |

---

## 5. Key Entities & Data Model

No new data entities are introduced. The three features are infrastructure/DX additions. For Swagger schema documentation, these are the existing entities that must be represented as OpenAPI component schemas:

### Product (existing — `src/types/product.ts`)
- id: string
- sourceUrl: string
- scrapedAt: string (ISO datetime)
- title: string
- price: number
- currency: string
- description: string | null
- images: string[]
- availability: enum (in_stock, out_of_stock, pre_order, unknown)
- brand: string | null
- sku: string | null
- mpn: string | null
- gtin: string | null
- category: string | null
- rating: number | null
- reviewCount: number | null
- specifications: object (key-value)
- seller: string | null
- shipping: string | null
- alternativePrices: array of { price, currency }
- confidenceScores: object (partial, field → 0-100)
- overallConfidence: number (0-100)
- extractionMethod: enum (adaptive, template, ai_fallback)
- metadata: object
- priceHistory: array of { price, currency, recordedAt } (optional)

### Schedule (existing — `src/types/schedule.ts`)
- id: string
- name: string
- cronExpression: string
- urlSource: string
- config: JobConfig object
- enabled: boolean
- lastRunAt: string | null
- lastRunStatus: enum (queued, running, completed, failed, paused) | null
- createdAt: string (ISO datetime)

### ScrapeJob (existing — `src/types/job.ts`)
- id: string
- status: enum (queued, running, completed, failed, paused)
- createdAt: string
- startedAt: string | null
- completedAt: string | null
- totalUrls: number
- completedUrls: number
- failedUrls: number
- tasks: ScrapeTask[]
- config: JobConfig

### JobConfig (existing — `src/types/job.ts`)
- maxRetries: number
- retryBaseDelay: number
- retryMultiplier: number
- rateLimit: number
- concurrentDomains: number
- proxyEnabled: boolean
- timeout: number

---

## 6. Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-001 | CI workflow runs automatically on push to master | Push a commit; observe Actions tab shows running workflow |
| SC-002 | CI workflow runs on pull requests | Open a PR; observe Actions tab shows workflow |
| SC-003 | All 4 matrix cells pass (2 Node versions × 1 OS) | Green check on all matrix jobs |
| SC-004 | CI badge shows "passing" in README | View README on GitHub; badge renders green "passing" |
| SC-005 | `docker compose up --build` produces a running container | Container starts; `curl localhost:4000/api/status` returns 200 |
| SC-006 | Data persists in `./data` volume | Write data, restart container, verify data exists |
| SC-007 | Docker health check passes | `docker ps` shows container as "healthy" |
| SC-008 | `/api-docs` serves Swagger UI | Navigate to URL; Swagger UI renders with all endpoints |
| SC-009 | All 10 endpoints documented with params, body, responses | Visual inspection of Swagger UI; each endpoint expandable |
| SC-010 | "Try it out" executes a real request | Click Try It Out on GET /api/status; response appears |
| SC-011 | Dashboard sidebar has "API Docs" link | Navigate to dashboard; see link; click navigates to /api-docs |
| SC-012 | Docs page nav has "API Docs" link | Navigate to /docs; see link in nav bar |
| SC-013 | All 111 existing tests still pass | Run `npm test`; all 111 pass |
| SC-014 | `tsc --noEmit` passes with zero errors | Run `npm run lint`; exit code 0 |

---

## 7. Edge Cases & Error Handling

### CI/CD Pipeline

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Node 20.x has different behavior than 22.x for ESM | Workflow matrix catches this; both must pass |
| Python pip install fails (network issue) | Workflow fails with clear error in the pip install step |
| Concurrent workflow runs on rapid pushes | GitHub Actions default concurrency — let them both run; they are independent |
| PR from fork | Workflow runs on the fork's code (standard GitHub Actions behavior) |
| `package-lock.json` or `engine/requirements.txt` changes | Cache invalidated, fresh install runs |

### Docker Container

| Edge Case | Expected Behavior |
|-----------|-------------------|
| `./data` directory doesn't exist on host | Docker Compose creates it via volume mount |
| Port 4000 already in use on host | `docker compose up` fails with clear port-conflict error; user must change port mapping |
| No internet during Python pip install in build | Docker build fails at pip install step with network error |
| Container runs on ARM (Apple Silicon) | Alpine images are multi-arch; should work. Python packages with C extensions (curl_cffi) may need build tools — install `build-base` in Dockerfile as safety net |
| `engine/scraper.py` can't find Python at `/usr/bin/python3` | Ensure the scrape-bridge's spawn call works inside the container. The engine path resolution uses `process.cwd()` + `engine/scraper.py`, so WORKDIR must be `/app` |
| Large `node_modules` in builder stage | Using `npm ci` ensures clean install; `--omit=dev` in runtime reduces size |

### Swagger/OpenAPI

| Edge Case | Expected Behavior |
|-----------|-------------------|
| `/api-docs` requested before server fully initialized | Express middleware registers synchronously; should work immediately |
| `/api-docs` with trailing slash (`/api-docs/`) | swagger-ui-express handles this — redirects to `/api-docs/` with trailing slash by default |
| Browser JavaScript disabled | Swagger UI requires JS; show basic HTML fallback (swagger-ui-express default behavior) |
| OpenAPI annotations have syntax errors | Server startup fails or swagger-jsdoc throws; caught during development/testing |
| Concurrent requests to `/api-docs` | Static content; no issues |
| swagger-jsdoc scans compiled JS but annotations are in TS source | Configure apis path to point to the TypeScript source files (swagger-jsdoc reads comments from any file type) |

---

## 8. Assumptions & Dependencies

### Assumptions

| # | Assumption |
|---|-----------|
| A1 | The GitHub repository is at `SufficientDaikon/harvesthub` with `master` as the primary branch |
| A2 | GitHub Actions is enabled on the repository |
| A3 | The `createServer` function in `src/api/server.ts` is the single place where Express routes and middleware are registered |
| A4 | Alpine Linux's `apk` package manager provides Python 3.12+ via `python3` and `py3-pip` packages |
| A5 | The CLI `dashboard` command (via `node dist/cli/index.js dashboard -p 4000`) is the intended production entry point for the server |
| A6 | `package-lock.json` exists and is committed (confirmed in project root) |
| A7 | The `PORT` environment variable is not currently read by the server (it uses CLI arg `-p`); Docker CMD must pass port explicitly |
| A8 | swagger-jsdoc can read `@openapi` JSDoc comments from `.ts` files without compilation |

### Dependencies

| # | Dependency | Version | Purpose |
|---|-----------|---------|---------|
| D1 | GitHub Actions runners | ubuntu-latest | CI execution environment |
| D2 | actions/checkout | v4 | Repository checkout |
| D3 | actions/setup-node | v4 | Node.js setup with caching |
| D4 | actions/setup-python | v5 | Python setup with caching |
| D5 | node:20-alpine | Docker base | Container base image |
| D6 | swagger-jsdoc | ^6.x | OpenAPI spec generation from JSDoc |
| D7 | swagger-ui-express | ^5.x | Swagger UI serving |
| D8 | @types/swagger-jsdoc | latest | TypeScript types |
| D9 | @types/swagger-ui-express | latest | TypeScript types |
| D10 | curl (in Alpine) | apk package | Docker healthcheck |

---

## 9. Out of Scope

| Item | Reason |
|------|--------|
| CD (Continuous Deployment) | Only CI (testing/validation) is in scope; auto-deploy is not requested |
| Docker registry publishing | No push to Docker Hub, GHCR, or any registry |
| Kubernetes manifests / Helm charts | Container orchestration beyond Compose is not requested |
| API authentication/authorization | No auth on `/api-docs` or any endpoint (matching current state) |
| OpenAPI code generation (client SDKs) | Spec is for documentation only |
| Swagger editor/admin capabilities | Read-only Swagger UI |
| Modifying existing API endpoint logic | Only adding annotations and middleware; no behavior changes |
| Modifying existing test files | Tests should pass as-is |
| Python engine tests | Python has no test framework configured; CI runs only vitest |
| Windows Docker support | Dockerfiles target Linux containers only |
| Rate limiting or security headers on /api-docs | Not in scope |

---

## 10. Implementation Guide

This section provides precise file-level instructions for the implementer. Each subsection maps to functional requirements.

### 10.1 File Manifest

| File | Action | Feature |
|------|--------|---------|
| `.github/workflows/ci.yml` | **CREATE** | CI/CD |
| `Dockerfile` | **CREATE** | Docker |
| `docker-compose.yml` | **CREATE** | Docker |
| `.dockerignore` | **CREATE** | Docker |
| `README.md` | **MODIFY** — add badges + Docker section | CI/CD, Docker, Swagger |
| `src/api/server.ts` | **MODIFY** — add swagger imports, setup, JSDoc annotations on all routes | Swagger |
| `src/api/swagger.ts` | **CREATE** — swagger configuration module (optional, may inline in server.ts) | Swagger |
| `dashboard/index.html` | **MODIFY** — add API Docs nav item in sidebar | Swagger |
| `dashboard/docs.html` | **MODIFY** — add API Docs link in nav | Swagger |
| `package.json` | **MODIFY** — add swagger dependencies | Swagger |

### 10.2 CI/CD Pipeline — `.github/workflows/ci.yml`

**FR-CI-001 through FR-CI-009**

```yaml
# Expected structure (implementer should produce the final YAML):
name: CI
on:
  push:
    branches: [master]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    steps:
      - Checkout (actions/checkout@v4)
      - Setup Node (actions/setup-node@v4 with node-version from matrix, cache 'npm')
      - Cache node_modules (actions/cache@v4, key based on package-lock.json hash)
      - npm ci
      - Setup Python 3.12 (actions/setup-python@v5, cache 'pip')
      - pip install scrapling curl_cffi orjson browserforge
      - npm run lint (tsc --noEmit)
      - npm test (vitest run)
```

**Key details:**
- The `actions/setup-node@v4` has built-in npm caching via `cache: 'npm'`. However, this caches the npm download cache, not `node_modules`. For faster installs, use `actions/cache@v4` on the `node_modules` path keyed on `hashFiles('package-lock.json')` and skip `npm ci` on cache hit.
- For pip caching, `actions/setup-python@v5` has `cache: 'pip'` built-in which caches the pip download cache. To make this work, you need a `requirements.txt` — use `engine/requirements.txt` but note it only lists scrapling and orjson. The pip install step should install all 4 packages regardless.
- The `pull_request` trigger with no branch filter runs on PRs targeting any branch.

### 10.3 Docker — `Dockerfile`

**FR-DK-001 through FR-DK-006, FR-DK-012, FR-DK-013**

```dockerfile
# Expected structure:

# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
COPY api/ ./api/
COPY scripts/ ./scripts/
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

# Install Python + pip + build tools for native extensions
RUN apk add --no-cache python3 py3-pip curl build-base python3-dev libffi-dev

# Install Python dependencies (use --break-system-packages on newer pip)
RUN pip3 install --no-cache-dir --break-system-packages scrapling curl_cffi orjson browserforge

# Copy production node deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Copy runtime assets
COPY engine/ ./engine/
COPY dashboard/ ./dashboard/
COPY data/ ./data/ 2>/dev/null || true

# Ensure data directories exist
RUN mkdir -p data/store data/exports data/logs

# Non-root user
RUN addgroup -S harvesthub && adduser -S harvesthub -G harvesthub
RUN chown -R harvesthub:harvesthub /app
USER harvesthub

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Install curl for healthcheck
# (Already available or install in root step before USER switch)

CMD ["node", "dist/cli/index.js", "dashboard", "-p", "4000"]
```

**Key details for implementer:**
- The `tsconfig.json` has `rootDir: "."` and `include: ["src/**/*", "scripts/**/*", "api/**/*"]`. The builder must copy all three source directories plus tsconfig.
- The `COPY data/ ./data/ 2>/dev/null || true` line is to handle the case where data/ may or may not have content. Alternatively, just `RUN mkdir -p data/store data/exports data/logs` is sufficient.
- `curl` must be available for the healthcheck. Either install it via `apk add curl` or use `wget` (pre-installed in Alpine) instead. If using wget, the healthcheck command changes.
- The `build-base`, `python3-dev`, and `libffi-dev` packages are needed for `curl_cffi` which has native extensions. After pip install, they could be removed to save space, but that adds complexity. Keep them for reliability.
- Consider whether `curl` needs to be installed before switching to non-root user (it does — `apk add` requires root).

### 10.4 Docker — `docker-compose.yml`

**FR-DK-007 through FR-DK-009**

```yaml
# Expected structure:
services:
  harvesthub:
    build: .
    ports:
      - "4000:4000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=4000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    restart: unless-stopped
```

**Key details:**
- No `version:` key needed (Docker Compose v2 spec).
- The `restart: unless-stopped` is a good practice for production containers.

### 10.5 Docker — `.dockerignore`

**FR-DK-010**

```
node_modules
.git
.github
dist
output
*.xlsx
*.log
.env
.env.*
processed-products*.xlsx
urls*.txt
test-urls.txt
sample-urls.txt
*.tsbuildinfo
.DS_Store
Thumbs.db
```

### 10.6 Swagger — Package Installation

**FR-SW-001**

Add to `package.json` dependencies:
```json
"swagger-jsdoc": "^6.2.8",
"swagger-ui-express": "^5.0.1"
```

Add to `package.json` devDependencies:
```json
"@types/swagger-jsdoc": "^6.0.4",
"@types/swagger-ui-express": "^4.1.7"
```

Then run `npm install`.

### 10.7 Swagger — Configuration & Middleware

**FR-SW-002, FR-SW-003, FR-SW-004**

In `src/api/server.ts`, add at the top:

```typescript
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
```

Create the swagger options object (can be in server.ts or a separate `src/api/swagger.ts` module):

```typescript
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HarvestHub API",
      version: "1.0.0",
      description: "Adaptive product scraping platform API — extract, search, filter, export and schedule product data from any e-commerce site.",
    },
    servers: [
      { url: "/", description: "Current server" }
    ],
  },
  apis: ["./src/api/server.ts"],  // Path to files with @openapi annotations
};
```

Register middleware in the `createServer` function, **before** route definitions:

```typescript
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

**Important implementation note:** `swagger-jsdoc` reads the annotations at server startup time from the file paths specified in `apis`. Since the server may be run from compiled `dist/` output, the `apis` path should resolve correctly. Two approaches:

1. **Preferred**: Point to the source `.ts` file using a path relative to `process.cwd()`: `"./src/api/server.ts"`. This works because `swagger-jsdoc` just reads the file as text to extract `@openapi` YAML blocks — it doesn't execute the TS.
2. **Alternative**: Extract all `@openapi` specs into a separate `.yaml` or `.json` file.

Approach 1 is recommended per NFR-007 (co-location).

**Docker consideration**: In the Docker container, only `dist/` is copied, not `src/`. The implementer must **also copy `src/api/server.ts` into the runtime image** (or just copy the entire `src/` directory) so swagger-jsdoc can read annotations at runtime. Alternatively, switch to approach 2 or generate the swagger spec at build time and embed it.

**Recommended Docker fix**: Add `COPY src/api/server.ts ./src/api/server.ts` to the Dockerfile runtime stage, OR change the `apis` path to `["./dist/api/server.js"]` and ensure the JSDoc comments survive TypeScript compilation (they do, since tsc preserves JSDoc comments when `removeComments` is not set — and it's not set in the current tsconfig). **Verify**: The current tsconfig does NOT set `removeComments: true`, so comments will be in the compiled JS. Using `./dist/api/server.js` as the apis path is the cleanest Docker-compatible approach.

**Updated recommendation**: Use `apis: [path.resolve(process.cwd(), "dist", "api", "server.js")]` for production, or detect environment:

```typescript
const apisPath = process.env.NODE_ENV === "production"
  ? ["./dist/api/server.js"]
  : ["./src/api/server.ts"];
```

Or simpler — just list both: `apis: ["./src/api/server.ts", "./dist/api/server.js"]`. swagger-jsdoc ignores files that don't exist.

### 10.8 Swagger — JSDoc Annotations on Routes

**FR-SW-005 through FR-SW-014, FR-SW-018, FR-SW-019**

Each route handler in `server.ts` must have a `/** @openapi */` JSDoc comment block above it containing the OpenAPI YAML specification for that endpoint.

**Example pattern for the implementer:**

```typescript
/**
 * @openapi
 * /api/status:
 *   get:
 *     summary: System status
 *     description: Returns engine health, product count, job history, and uptime
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 engine:
 *                   type: string
 *                   enum: [ready, unavailable]
 *                   example: ready
 *                 userAgents:
 *                   type: integer
 *                   example: 20
 *                 proxies:
 *                   type: integer
 *                   example: 0
 *                 productCount:
 *                   type: integer
 *                   example: 42
 *                 totalJobs:
 *                   type: integer
 *                   example: 5
 *                 lastJob:
 *                   type: object
 *                   nullable: true
 *                 uptime:
 *                   type: number
 *                   example: 3600.5
 *       500:
 *         description: Status check failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/api/status", async (_req, res) => { ... });
```

**Reusable component schemas** to define (FR-SW-018):

Place these in a `@openapi` block at the top of server.ts (or in the swagger config):

```yaml
components:
  schemas:
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
      example:
        error: "Something went wrong"

    Product:
      type: object
      properties:
        id: { type: string }
        sourceUrl: { type: string, format: uri }
        scrapedAt: { type: string, format: date-time }
        title: { type: string }
        price: { type: number }
        currency: { type: string }
        description: { type: string, nullable: true }
        images: { type: array, items: { type: string } }
        availability: { type: string, enum: [in_stock, out_of_stock, pre_order, unknown] }
        brand: { type: string, nullable: true }
        sku: { type: string, nullable: true }
        # ... all fields from Product type
        overallConfidence: { type: number, minimum: 0, maximum: 100 }
        extractionMethod: { type: string, enum: [adaptive, template, ai_fallback] }

    Schedule:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        cronExpression: { type: string }
        urlSource: { type: string }
        config: { $ref: '#/components/schemas/JobConfig' }
        enabled: { type: boolean }
        lastRunAt: { type: string, nullable: true }
        lastRunStatus: { type: string, nullable: true, enum: [queued, running, completed, failed, paused] }
        createdAt: { type: string, format: date-time }
        running: { type: boolean }

    JobConfig:
      type: object
      properties:
        maxRetries: { type: integer }
        retryBaseDelay: { type: integer }
        retryMultiplier: { type: number }
        rateLimit: { type: number }
        concurrentDomains: { type: integer }
        proxyEnabled: { type: boolean }
        timeout: { type: integer }
```

**Tags to use for organization:**
- `System` — /api/status
- `Products` — /api/products, /api/products/:id/history
- `Statistics` — /api/stats
- `Export` — /api/export/:format
- `Jobs` — /api/jobs
- `Schedules` — /api/schedules (all CRUD)

### 10.9 Dashboard Modifications

**FR-SW-015 — Dashboard sidebar (`dashboard/index.html`)**

Insert a new nav item after the "Schedules" button (line 621) and before the "Documentation" link (line 622):

```html
<a href="/api-docs" target="_blank" class="nav-item" style="text-decoration:none;color:inherit;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;transition:var(--transition)">
  <span style="font-size:16px">📡</span>
  API Docs
</a>
```

**FR-SW-016 — Docs page nav (`dashboard/docs.html`)**

In the `.nav-links` div (around line 1000-1010), add before the "Dashboard" link:

```html
<a href="/api-docs" target="_blank">API Docs</a>
```

### 10.10 README.md Modifications

**FR-CI-007 — CI badge**

Add to the badge row (after line 9, the Tests badge):
```markdown
[![CI](https://github.com/SufficientDaikon/harvesthub/actions/workflows/ci.yml/badge.svg)](https://github.com/SufficientDaikon/harvesthub/actions/workflows/ci.yml)
```

**FR-SW-017 — Swagger badge**

Add to the badge row:
```markdown
[![API Docs](https://img.shields.io/badge/API_Docs-Swagger-85EA2D?logo=swagger&logoColor=black)](#api-endpoints)
```

**FR-DK-011 — Docker section**

Add a "Docker" subsection under the existing "Deployment" section (after the Vercel subsection, around line 354). Content:

```markdown
### Docker

Run the entire platform in a container — no Node.js or Python installation required.

```bash
# Build and start
docker compose up --build

# Or build and run standalone
docker build -t harvesthub .
docker run -p 4000:4000 -v ./data:/app/data harvesthub
```

The `./data` directory is mounted as a volume so scraped products persist across container restarts.

**Environment variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `4000` | API server port |
```

---

## 11. Acceptance Checklist

### Spec Self-Validation

- [x] No implementation language/framework mandated (Docker/GitHub Actions are infrastructure requirements, not implementation choices)
- [x] All requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Zero `[NEEDS CLARIFICATION]` markers remain
- [x] Every user story has acceptance scenarios in Given/When/Then
- [x] Edge cases identified for every major flow
- [x] Scope clearly bounded (in-scope AND out-of-scope)
- [x] All functional requirements trace to at least one user story

### Implementation Acceptance Tests

The implementer should verify all of the following before declaring the work complete:

#### CI/CD
- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] Workflow triggers on push to master
- [ ] Workflow triggers on pull requests
- [ ] Matrix includes Node 20.x and 22.x
- [ ] Python 3.12 is set up with pip packages
- [ ] `tsc --noEmit` step exists and runs
- [ ] `vitest run` step exists and runs
- [ ] node_modules caching is configured
- [ ] pip caching is configured
- [ ] `.github/workflows/pages.yml` is untouched
- [ ] CI badge added to README.md

#### Docker
- [ ] `Dockerfile` exists at project root
- [ ] Multi-stage build: builder (Node 20 alpine) → runtime (Node 20 alpine + Python)
- [ ] `docker build -t harvesthub .` completes without errors
- [ ] `docker run -p 4000:4000 harvesthub` starts and `curl localhost:4000/api/status` returns 200
- [ ] `docker-compose.yml` exists at project root
- [ ] `docker compose up --build` works end-to-end
- [ ] Volume mount `./data:/app/data` is configured
- [ ] Healthcheck is configured and passes
- [ ] `.dockerignore` exists with appropriate exclusions
- [ ] Non-root user is used in runtime stage
- [ ] Docker instructions added to README.md

#### Swagger/OpenAPI
- [ ] `swagger-jsdoc` and `swagger-ui-express` in package.json dependencies
- [ ] `@types/swagger-jsdoc` and `@types/swagger-ui-express` in devDependencies
- [ ] `/api-docs` serves Swagger UI
- [ ] API title is "HarvestHub API", version "1.0.0"
- [ ] GET /api/status documented with response schema
- [ ] GET /api/products documented with all query params
- [ ] GET /api/products/:id/history documented
- [ ] GET /api/stats documented
- [ ] GET /api/export/:format documented with enum
- [ ] GET /api/jobs documented
- [ ] GET /api/schedules documented
- [ ] POST /api/schedules documented with request body
- [ ] PATCH /api/schedules/:id documented
- [ ] DELETE /api/schedules/:id documented
- [ ] Error responses (400, 404, 500) documented on relevant endpoints
- [ ] Reusable component schemas defined (Product, Schedule, ErrorResponse, etc.)
- [ ] Example responses on all endpoints
- [ ] Dashboard sidebar has "API Docs" link pointing to /api-docs
- [ ] Docs page nav has "API Docs" link
- [ ] Swagger badge added to README.md
- [ ] `npm run lint` (tsc --noEmit) passes with 0 errors
- [ ] `npm test` passes all 111 tests
- [ ] No existing endpoint behavior changed

---

*End of specification.*
