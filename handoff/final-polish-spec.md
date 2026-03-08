# HarvestHub — Final Polish Specification

**Spec ID:** `FINAL-POLISH-001`
**Version:** 1.0
**Date:** 2025-07-15
**Status:** Ready for Implementation
**Author:** Specification Architect (SDD Pipeline)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Current State Baseline](#2-current-state-baseline)
3. [Feature 1 — Terminal Demo SVG](#3-feature-1--terminal-demo-svg)
4. [Feature 2 — Fix CI Pipeline](#4-feature-2--fix-ci-pipeline)
5. [Feature 3 — Cost Savings Calculator](#5-feature-3--cost-savings-calculator)
6. [Feature 4 — Code Coverage Badge](#6-feature-4--code-coverage-badge)
7. [Feature 5 — Contributing Guide & Issue Templates](#7-feature-5--contributing-guide--issue-templates)
8. [Feature 6 — Vercel Deployment](#8-feature-6--vercel-deployment)
9. [Feature 7 — npm Package Publishing](#9-feature-7--npm-package-publishing)
10. [Feature 8 — Chrome Extension](#10-feature-8--chrome-extension)
11. [Cross-Cutting Concerns](#11-cross-cutting-concerns)
12. [Assumptions & Dependencies](#12-assumptions--dependencies)
13. [Out of Scope](#13-out-of-scope)
14. [Acceptance Checklist](#14-acceptance-checklist)

---

## 1. Project Overview

### What We're Building

Eight "final polish" features that elevate HarvestHub from a working scraping platform into a professional, open-source-ready product. These features span developer experience (CI, coverage, contributing guide), marketing and discoverability (demo SVG, cost calculator, npm publishing, deploy button), and ecosystem expansion (Chrome extension).

### Why

HarvestHub has a solid core: 140 passing tests, zero TypeScript errors, a working Express API, CLI with 7 commands, and a live marketing site. What's missing is the _packaging_: the demo that sells the tool in 10 seconds, the green CI badge that builds trust, the one-click install that lowers the barrier to adoption, and the browser extension that meets users where they already are.

### For Whom

| Actor                        | Needs from this spec                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| **Open-source contributor**  | Green CI badge, CONTRIBUTING.md, issue templates, PR template     |
| **Evaluating developer**     | Terminal demo SVG, cost calculator, coverage badge, deploy button |
| **End user (technical)**     | npm global install, Chrome extension, Vercel one-click            |
| **End user (non-technical)** | Chrome extension popup, cost savings calculator                   |
| **Project maintainer**       | Reliable CI, Codecov integration, npm publish workflow            |

---

## 2. Current State Baseline

These facts were verified by reading the codebase and inform every requirement below.

| Property          | Value                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Repository        | `SufficientDaikon/harvesthub` on GitHub, branch `master`                                                                 |
| Test suite        | 140 vitest tests passing, 0 TypeScript errors                                                                            |
| API server        | Express via `createServer(port = 3000)` in `src/api/server.ts`                                                           |
| Serverless entry  | `api/index.ts` — imports `createServer`, exports Express app                                                             |
| CLI entry         | `src/cli/index.ts` — commands: `scrape`, `export`, `status`, `migrate`, `dashboard`, `schedule`, `batch`                 |
| CLI binary name   | `harvest` (package.json `bin.harvest`)                                                                                   |
| Dashboard         | `dashboard/` directory, served as static by Express                                                                      |
| Marketing pages   | `dashboard/marketing.html` (EN), `dashboard/marketing-ar.html` (AR)                                                      |
| Design system     | Dark theme: `--bg-primary: #0F172A`, `--emerald: #10B981`, font: Inter + JetBrains Mono                                  |
| Vercel config     | `vercel.json` — routes all to `api/index.ts`, includes `dashboard/**`                                                    |
| CI                | `.github/workflows/ci.yml` — Ubuntu, Node 20+22, Python 3.12, Playwright                                                 |
| Python deps       | `scrapling`, `curl_cffi`, `orjson`, `browserforge`                                                                       |
| Source files      | 57 `.ts` files across `src/{alerts,api,cli,core,export,lib,pipeline,store,types,__tests__}`                              |
| Missing artifacts | No `CONTRIBUTING.md`, no `.github/ISSUE_TEMPLATE/`, no `.github/PULL_REQUEST_TEMPLATE.md`, no `assets/`, no `extension/` |
| Package module    | `"type": "module"` in package.json                                                                                       |
| README badges     | Tests (static), CI (GitHub Actions), TypeScript, Python, API Docs, License, Cost                                         |

---

## 3. Feature 1 — Terminal Demo SVG

### 3.1 User Stories

#### US-1.1: Developer evaluates HarvestHub from README (P1)

> **As a** developer visiting the GitHub repository,
> **I want to** see an animated terminal demo immediately after the badges,
> **So that** I understand what HarvestHub does in under 15 seconds without cloning anything.

**Acceptance Scenarios:**

```
GIVEN I open the README.md on GitHub
WHEN the page loads
THEN I see an animated SVG below the badges showing a terminal session
  AND the animation plays automatically in a loop
  AND the terminal shows realistic CLI commands and output
```

```
GIVEN I view the README on a mobile device
WHEN the page loads
THEN the demo SVG scales down responsively while remaining readable
```

### 3.2 Functional Requirements

| ID      | Requirement                                                                                                                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-1.01 | An animated SVG file SHALL exist at `assets/demo.svg`                                                                                                                                                                                                                                                              |
| FR-1.02 | The SVG SHALL use a dark background color matching the project's dark theme (`#0F172A` or similar terminal palette such as `#1a1b26`)                                                                                                                                                                              |
| FR-1.03 | The SVG SHALL render a terminal window chrome (title bar with traffic light dots or similar decoration, window title "HarvestHub")                                                                                                                                                                                 |
| FR-1.04 | The SVG SHALL animate at least three CLI interactions in sequence: (1) `harvest scrape <url>` with progress output showing tier detection, progress bar, and a success summary; (2) `harvest status` with a tabular summary of scraped products; (3) `harvest export --format xlsx` with file-written confirmation |
| FR-1.05 | CLI output text SHALL use syntax coloring: emerald (`#10B981`) for success messages, cyan/blue for info, yellow for warnings, white/gray for standard text, matching the chalk color palette used by the real CLI                                                                                                  |
| FR-1.06 | Animation SHALL use CSS `@keyframes` embedded within the SVG (no JavaScript, no external resources)                                                                                                                                                                                                                |
| FR-1.07 | Characters SHALL appear with a realistic typing effect (sequential reveal per character or per line group with appropriate delays)                                                                                                                                                                                 |
| FR-1.08 | The full animation cycle SHALL complete in 12–18 seconds and loop infinitely                                                                                                                                                                                                                                       |
| FR-1.09 | A blinking cursor element SHALL be visible at the active typing position                                                                                                                                                                                                                                           |
| FR-1.10 | `README.md` SHALL embed the SVG using an `<img>` tag (not `<object>` or `<embed>`) centered below the badges and above the "What is HarvestHub?" heading                                                                                                                                                           |
| FR-1.11 | The SVG SHALL have a fixed aspect ratio that renders correctly at widths from 400px to 900px                                                                                                                                                                                                                       |
| FR-1.12 | The SVG file size SHALL be under 50 KB                                                                                                                                                                                                                                                                             |

### 3.3 Edge Cases

| Case                               | Expected Behavior                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser disables CSS animations    | User sees the final frame (all commands visible) as a static image                                                                                 |
| SVG rendered in email client       | Fallback to static final frame; no broken rendering                                                                                                |
| Dark mode vs. light mode repo view | SVG has its own dark background, so it appears consistently regardless of GitHub theme                                                             |
| Screen reader / accessibility      | SVG SHALL include a `<title>` element: "HarvestHub CLI Demo — showing scrape, status, and export commands" and `role="img"` on the `<svg>` element |

---

## 4. Feature 2 — Fix CI Pipeline

### 4.1 User Stories

#### US-2.1: Maintainer gets green CI badge (P1)

> **As a** project maintainer,
> **I want** the CI pipeline to pass reliably on every push to master,
> **So that** the CI badge in the README is green and contributors trust the project.

**Acceptance Scenarios:**

```
GIVEN a push to the master branch
WHEN the CI workflow runs on ubuntu-latest with Node 20.x and 22.x
THEN all steps complete successfully
  AND the CI badge shows "passing"
```

```
GIVEN the Python dependencies fail to install (e.g., curl_cffi native compilation fails)
WHEN the CI workflow runs
THEN the workflow uses a fallback strategy (continue-on-error + skip-dependent-steps OR pre-built wheel cache)
  AND the vitest unit tests still run and pass
  AND the failure is clearly logged for debugging
```

#### US-2.2: Contributor submits a PR and sees CI results (P1)

> **As a** contributor opening a pull request,
> **I want** CI to run on my PR and report results,
> **So that** I know my changes don't break anything before review.

**Acceptance Scenarios:**

```
GIVEN I open a pull request against master
WHEN CI triggers
THEN type-check, unit tests, and E2E tests run
  AND results are reported as GitHub status checks on the PR
```

### 4.2 Functional Requirements

| ID      | Requirement                                                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-2.01 | The CI workflow file SHALL be `.github/workflows/ci.yml` and trigger on `push` to `master` and on `pull_request`                                                                                                                              |
| FR-2.02 | The workflow SHALL install system-level dependencies required by `curl_cffi` and `scrapling` on Ubuntu (e.g., `build-essential`, `libssl-dev`, `libffi-dev`, `libcurl4-openssl-dev` or equivalent) via an `apt-get` step before `pip install` |
| FR-2.03 | If native Python dependency installation fails, the workflow SHALL use `continue-on-error: true` on the Python install step AND subsequent Python-dependent steps SHALL check for engine availability before executing                        |
| FR-2.04 | The Playwright install step SHALL run `npx playwright install --with-deps chromium` to ensure browser binaries AND OS-level dependencies (e.g., `libgbm`, `libatk`) are installed                                                             |
| FR-2.05 | The workflow SHALL cache `node_modules` keyed by `package-lock.json` hash (already present — verify correctness)                                                                                                                              |
| FR-2.06 | The workflow SHALL cache pip packages keyed by `engine/requirements.txt` hash (already present — verify correctness)                                                                                                                          |
| FR-2.07 | The E2E test step SHALL set environment variable `PORT=4000` (already present — preserve)                                                                                                                                                     |
| FR-2.08 | The workflow SHALL upload E2E screenshots as artifacts on failure (already present — preserve)                                                                                                                                                |
| FR-2.09 | The workflow SHALL include a build step (`npx tsc`) before tests to verify compilation succeeds                                                                                                                                               |
| FR-2.10 | The Node.js matrix SHALL include versions `20.x` and `22.x`                                                                                                                                                                                   |
| FR-2.11 | All vitest tests (currently 140) SHALL pass in CI                                                                                                                                                                                             |
| FR-2.12 | The CI badge URL in README.md SHALL correctly point to `https://github.com/SufficientDaikon/harvesthub/actions/workflows/ci.yml/badge.svg` (already present — preserve)                                                                       |

### 4.3 Edge Cases

| Case                                                     | Expected Behavior                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `curl_cffi` wheel not available for Ubuntu + Python 3.12 | `continue-on-error` on pip install; vitest tests (which mock the Python bridge) still pass   |
| Playwright browser binary cache miss                     | `--with-deps` flag ensures OS deps are installed alongside browser download                  |
| `package-lock.json` out of sync with `package.json`      | `npm ci` fails fast with clear error (expected behavior)                                     |
| E2E tests fail due to port conflict                      | PORT=4000 is explicitly set; if still conflicts, E2E tests fail and screenshots are uploaded |
| Rate limiting on pip/npm registries                      | Caching steps reduce likelihood; no additional mitigation required                           |

---

## 5. Feature 3 — Cost Savings Calculator

### 5.1 User Stories

#### US-3.1: Business user calculates ROI (P1)

> **As a** potential user evaluating HarvestHub,
> **I want to** calculate how much time and money I'd save using HarvestHub vs. manual data collection,
> **So that** I can justify adopting the tool to my team or manager.

**Acceptance Scenarios:**

```
GIVEN I visit the marketing page
WHEN I scroll to the Cost Savings Calculator section
THEN I see interactive input controls for my scenario parameters
  AND default values are pre-populated with a realistic scenario
```

```
GIVEN I adjust the "Number of products" slider to 500
  AND I set "Scraping frequency" to "Daily"
  AND I set "Current method" to "Manual"
  AND I set "Hourly rate" to $50
WHEN the values update
THEN the calculator immediately (within 100ms) displays:
  - Hours saved per month
  - Dollar amount saved per month
  - Dollar amount saved per year
  AND the numbers animate from previous values to new values (counter animation)
```

```
GIVEN I view the calculator on a 375px-wide mobile screen
WHEN the section renders
THEN all inputs are usable and results are visible without horizontal scrolling
```

#### US-3.2: Arabic-speaking user sees localized calculator (P2)

> **As an** Arabic-speaking visitor on marketing-ar.html,
> **I want** the same cost savings calculator with Arabic labels and RTL layout,
> **So that** I get the same value proposition in my language.

**Acceptance Scenarios:**

```
GIVEN I visit marketing-ar.html
WHEN I scroll to the calculator section
THEN all labels are in Arabic
  AND the layout is RTL
  AND the currency symbol is positioned correctly for RTL
  AND the calculator logic works identically to the English version
```

### 5.2 Functional Requirements

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-3.01 | A new section SHALL be added to `dashboard/marketing.html` with id `roi-calculator` and heading "Calculate Your Savings"                                                                                                                                                                                                                                                                                                                                                        |
| FR-3.02 | The section SHALL contain four user input controls: (1) **Product count** — range slider, min 10, max 10,000, default 200, with displayed numeric value; (2) **Scraping frequency** — select/segmented control with options: Daily, Weekly, Bi-weekly, Monthly; (3) **Current method** — select/segmented control with options: Manual copy-paste, Semi-automated (existing scripts), Paid scraping service; (4) **Hourly rate** — numeric input, min $5, max $500, default $35 |
| FR-3.03 | The calculator SHALL compute results using these formulas: (a) `minutesPerProductManual = 3` (manual), `1.5` (semi-automated), `0.5` (paid service — representing management overhead); (b) `monthlyRuns = { Daily: 30, Weekly: 4, "Bi-weekly": 2, Monthly: 1 }`; (c) `hoursPerMonth = (productCount × minutesPerProduct × monthlyRuns) / 60`; (d) `costPerMonth = hoursPerMonth × hourlyRate`; (e) `costPerYear = costPerMonth × 12`                                           |
| FR-3.04 | Three result cards SHALL display: (1) **Hours saved/month** with a clock icon; (2) **$ saved/month** with a dollar icon; (3) **$ saved/year** with a chart-up icon                                                                                                                                                                                                                                                                                                              |
| FR-3.05 | Result numbers SHALL animate from their previous value to the new value using a counter animation (eased, 600ms duration) whenever any input changes                                                                                                                                                                                                                                                                                                                            |
| FR-3.06 | The section SHALL use the existing design system: `--bg-card: #1a2539` for cards, `--emerald: #10B981` for accent colors, `--font-sans` for labels, `--font-mono` for numbers, `--radius` for border-radius, `.reveal` class for scroll-triggered entrance                                                                                                                                                                                                                      |
| FR-3.07 | Slider tracks SHALL be styled with emerald color for the filled portion                                                                                                                                                                                                                                                                                                                                                                                                         |
| FR-3.08 | All calculator logic SHALL be implemented in inline `<script>` at the bottom of the HTML file — no external JS files                                                                                                                                                                                                                                                                                                                                                            |
| FR-3.09 | An equivalent section SHALL be added to `dashboard/marketing-ar.html` with: (a) Arabic labels for all controls and headings; (b) RTL layout (the page already uses `dir="rtl"`); (c) Identical calculation formulas; (d) Currency display formatted for RTL contexts                                                                                                                                                                                                            |
| FR-3.10 | The calculator section SHALL be responsive: single-column layout below 768px, multi-column above                                                                                                                                                                                                                                                                                                                                                                                |
| FR-3.11 | The product count slider SHALL display its current value in a tooltip or adjacent label that updates in real-time as the slider moves                                                                                                                                                                                                                                                                                                                                           |
| FR-3.12 | Large numbers SHALL be formatted with locale-appropriate separators (commas for EN, appropriate for AR)                                                                                                                                                                                                                                                                                                                                                                         |

### 5.3 Edge Cases

| Case                                           | Expected Behavior                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| User drags slider to minimum (10 products)     | Calculator shows small but non-zero savings                                                                                      |
| User drags slider to maximum (10,000 products) | Numbers are large but formatted with commas; no overflow of display containers                                                   |
| User types non-numeric value in hourly rate    | Input is clamped to min/max range; invalid input is rejected                                                                     |
| User changes frequency rapidly                 | Debounce or immediate recalc; no animation queue buildup (cancel previous animation on new input)                                |
| JavaScript disabled                            | Section is visible but inputs are inert; result cards show default values or a message "Enable JavaScript to use the calculator" |

---

## 6. Feature 4 — Code Coverage Badge

### 6.1 User Stories

#### US-4.1: Contributor sees coverage metrics (P1)

> **As a** contributor or maintainer,
> **I want** code coverage measured and reported on every CI run,
> **So that** I can track test quality and prevent coverage regressions.

**Acceptance Scenarios:**

```
GIVEN a push to master
WHEN the CI pipeline completes
THEN a coverage report is generated using v8 provider
  AND the report is uploaded to Codecov
  AND the Codecov badge in README shows the current coverage percentage
```

```
GIVEN I run `npm run test:coverage` locally
WHEN tests complete
THEN a coverage summary is printed to the terminal
  AND an HTML coverage report is generated in `coverage/` directory
```

#### US-4.2: README visitor sees coverage at a glance (P2)

> **As a** developer evaluating HarvestHub,
> **I want** to see a coverage percentage badge in the README,
> **So that** I can assess test quality at a glance.

**Acceptance Scenarios:**

```
GIVEN I view the README on GitHub
WHEN I look at the badge row
THEN I see a Codecov badge showing the coverage percentage
  AND clicking it takes me to the Codecov dashboard for the repo
```

### 6.2 Functional Requirements

| ID      | Requirement                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-4.01 | `@vitest/coverage-v8` SHALL be added as a devDependency in `package.json`                                                                                                                                          |
| FR-4.02 | `vitest.config.ts` SHALL be updated to include `coverage` configuration: `provider: "v8"`, `reporter: ["text", "text-summary", "lcov", "html"]`, `reportsDirectory: "coverage"`                                    |
| FR-4.03 | A `test:coverage` script SHALL be added to `package.json`: `"test:coverage": "vitest run --coverage"`                                                                                                              |
| FR-4.04 | The `coverage/` directory SHALL be added to `.gitignore` (create if not exists)                                                                                                                                    |
| FR-4.05 | The CI workflow SHALL include a step that runs `npx vitest run --coverage` (replacing or supplementing the existing `npx vitest run` step)                                                                         |
| FR-4.06 | The CI workflow SHALL include a step to upload coverage to Codecov using `codecov/codecov-action@v4` with the `files` parameter pointing to `coverage/lcov.info`                                                   |
| FR-4.07 | The Codecov upload step SHALL use `fail_ci_if_error: false` so that Codecov outages don't break the build                                                                                                          |
| FR-4.08 | The Codecov upload step SHALL use a `CODECOV_TOKEN` secret (referenced as `${{ secrets.CODECOV_TOKEN }}`)                                                                                                          |
| FR-4.09 | A Codecov badge SHALL be added to `README.md` in the badge row: `[![codecov](https://codecov.io/gh/SufficientDaikon/harvesthub/branch/master/graph/badge.svg)](https://codecov.io/gh/SufficientDaikon/harvesthub)` |
| FR-4.10 | The existing static test count badge in README (`tests-111%20passing`) SHALL be updated to reflect the current count of `140 passing`                                                                              |

### 6.3 Edge Cases

| Case                                                                   | Expected Behavior                                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Codecov token not configured in repo secrets                           | Upload step fails silently (`fail_ci_if_error: false`); CI still passes; badge shows "unknown" |
| Coverage report file not found                                         | Codecov upload step logs warning; CI still passes                                              |
| Developer runs `test:coverage` without `@vitest/coverage-v8` installed | vitest prints a clear error message prompting installation                                     |
| `.gitignore` doesn't exist                                             | Create it with `coverage/` and `node_modules/` entries                                         |

---

## 7. Feature 5 — Contributing Guide & Issue Templates

### 7.1 User Stories

#### US-5.1: New contributor knows how to set up the project (P1)

> **As a** developer who wants to contribute to HarvestHub,
> **I want** a clear contributing guide,
> **So that** I can set up my development environment, understand the workflow, and submit quality PRs.

**Acceptance Scenarios:**

```
GIVEN I open CONTRIBUTING.md
WHEN I read it
THEN I find sections for: prerequisites, setup steps, development workflow, code style, testing, architecture overview, and PR process
  AND the setup instructions work on macOS, Linux, and Windows
```

#### US-5.2: User reports a bug with structured information (P1)

> **As a** user who found a bug,
> **I want** a bug report template that prompts me for relevant details,
> **So that** maintainers can reproduce and fix my issue quickly.

**Acceptance Scenarios:**

```
GIVEN I click "New Issue" on the GitHub repository
WHEN the issue template chooser appears
THEN I see at least two options: "Bug Report" and "Feature Request"
```

```
GIVEN I select "Bug Report"
WHEN the template loads
THEN I see pre-populated sections for: description, steps to reproduce, expected behavior, actual behavior, environment (OS, Node version, Python version), and screenshots
```

#### US-5.3: Contributor opens a PR with consistent format (P2)

> **As a** PR reviewer,
> **I want** all PRs to follow a consistent template,
> **So that** I can review efficiently.

**Acceptance Scenarios:**

```
GIVEN a contributor opens a new pull request
WHEN the PR editor loads
THEN a template is pre-populated with sections: summary of changes, type of change, testing done, checklist
```

### 7.2 Functional Requirements

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-5.01 | A `CONTRIBUTING.md` file SHALL exist at the repository root                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| FR-5.02 | `CONTRIBUTING.md` SHALL contain these sections in order: (1) **Welcome** — brief, friendly intro; (2) **Prerequisites** — Node.js ≥20, Python ≥3.11, npm, pip; (3) **Setup** — clone, `npm install`, `pip install -r engine/requirements.txt`, verify with `npm test`; (4) **Development Workflow** — branch naming (`feature/`, `fix/`, `docs/`), commit message format (conventional commits), PR process; (5) **Code Style** — TypeScript strict mode, ESM imports, Zod for validation, pino for logging; (6) **Testing** — running vitest (`npm test`), adding tests in `src/__tests__/`, E2E in `e2e/`, coverage with `npm run test:coverage`; (7) **Architecture Overview** — brief description of `src/` subdirectories (cli, api, core, engine bridge, export, store, types); (8) **Reporting Issues** — link to issue templates |
| FR-5.03 | A bug report template SHALL exist at `.github/ISSUE_TEMPLATE/bug_report.md` with YAML front matter (`name`, `description`, `labels: ["bug"]`) and body sections: **Describe the bug**, **Steps to reproduce** (numbered list), **Expected behavior**, **Actual behavior**, **Environment** (OS, Node version, Python version, HarvestHub version), **Screenshots** (optional), **Additional context**                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| FR-5.04 | A feature request template SHALL exist at `.github/ISSUE_TEMPLATE/feature_request.md` with YAML front matter (`name`, `description`, `labels: ["enhancement"]`) and body sections: **Problem statement** ("Is your feature request related to a problem?"), **Proposed solution**, **Alternatives considered**, **Additional context**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| FR-5.05 | A PR template SHALL exist at `.github/PULL_REQUEST_TEMPLATE.md` with sections: **Summary** (what and why), **Type of change** (checkboxes: bug fix, new feature, breaking change, documentation), **How has this been tested?**, **Checklist** (checkboxes: tests pass, types check, docs updated if needed, no console.log left)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| FR-5.06 | All template files SHALL use Markdown format compatible with GitHub's template rendering                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| FR-5.07 | `CONTRIBUTING.md` SHALL reference the project's actual directory structure and commands from `package.json` (`npm test`, `npm run build`, `npm run lint`, `npm run dev`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### 7.3 Edge Cases

| Case                                      | Expected Behavior                                                                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contributor uses Windows (not WSL)        | Setup instructions mention Windows compatibility; Python venv commands shown for both bash and PowerShell                                                      |
| Contributor doesn't have Python installed | `CONTRIBUTING.md` notes that Python is only required for the scraping engine; TS-only contributions can skip Python setup; vitest tests mock the Python bridge |
| Issue template directory doesn't exist    | Create `.github/ISSUE_TEMPLATE/` directory and files                                                                                                           |

---

## 8. Feature 6 — Vercel Deployment

### 8.1 User Stories

#### US-6.1: Developer deploys HarvestHub in one click (P1)

> **As a** developer who wants to try HarvestHub,
> **I want** a "Deploy to Vercel" button in the README,
> **So that** I can get a live instance running without any local setup.

**Acceptance Scenarios:**

```
GIVEN I click the "Deploy to Vercel" button in the README
WHEN Vercel clones the repo and builds
THEN the dashboard is accessible at the deployed URL
  AND the API endpoints respond (returning read-only data or appropriate "scraping unavailable" responses)
```

```
GIVEN the Vercel deployment is live
WHEN I navigate to /marketing
THEN the marketing page loads with all styles and interactivity
```

#### US-6.2: API gracefully degrades without Python (P1)

> **As a** user of the Vercel-deployed instance,
> **I want** the API to clearly communicate when scraping is unavailable,
> **So that** I understand the limitation and know to use a local deployment for full functionality.

**Acceptance Scenarios:**

```
GIVEN I call POST /api/scrape on the Vercel instance
WHEN the server processes the request
THEN it returns HTTP 503 with a JSON body:
  { "error": "Scraping unavailable in serverless mode. Deploy locally for full functionality.", "docs": "https://github.com/SufficientDaikon/harvesthub#quick-start" }
```

```
GIVEN I call GET /api/products on the Vercel instance
WHEN the server processes the request
THEN it returns whatever product data exists in the pre-deployed data store (read-only mode)
```

### 8.2 Functional Requirements

| ID      | Requirement                                                                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-6.01 | `vercel.json` SHALL configure the project with Vercel framework version 2                                                                                                                                                                                  |
| FR-6.02 | `vercel.json` SHALL define a build for `api/index.ts` using `@vercel/node` with `includeFiles` covering `dashboard/**`, `data/store/**`, and `src/**`                                                                                                      |
| FR-6.03 | `vercel.json` SHALL define routing rules that: (a) serve static files from `dashboard/` for known static paths (`.html`, `.css`, `.js`, images); (b) route all other requests to `api/index.ts`                                                            |
| FR-6.04 | `api/index.ts` SHALL import `createServer` from `src/api/server.js` and export the Express app as the default export                                                                                                                                       |
| FR-6.05 | `api/index.ts` SHALL set an environment flag (e.g., `process.env.VERCEL = "1"`) or detect the Vercel environment (Vercel auto-sets `VERCEL=1`) to enable graceful degradation                                                                              |
| FR-6.06 | The Express server SHALL detect serverless/Vercel mode and return HTTP 503 with a descriptive JSON error for any endpoint that requires the Python scraping engine (scrape endpoints, schedule endpoints)                                                  |
| FR-6.07 | Read-only endpoints (GET `/api/products`, GET `/api/health`, GET `/api/export`, static dashboard files) SHALL function normally on Vercel                                                                                                                  |
| FR-6.08 | A "Deploy to Vercel" button SHALL be added to `README.md` using the official Vercel deploy button format: `[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SufficientDaikon/harvesthub)` |
| FR-6.09 | The deploy button SHALL be placed in the README in a "Deployment" section or near the Quick Start section                                                                                                                                                  |
| FR-6.10 | `vercel.json` SHALL set `"env": { "NODE_ENV": "production" }`                                                                                                                                                                                              |

### 8.3 Edge Cases

| Case                                                    | Expected Behavior                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| WebSocket upgrade request on Vercel                     | Vercel does not support WebSocket; the server SHALL not crash. The Express app should only start the WS server when NOT in serverless mode |
| `data/store/` directory is empty on fresh Vercel deploy | Read-only endpoints return empty arrays/objects; no errors                                                                                 |
| Vercel function timeout (default 10s on hobby plan)     | Read-only endpoints respond well within timeout; scrape endpoints are blocked before they can time out                                     |
| User navigates to `/dashboard` or `/marketing`          | Express serves the correct HTML file from `dashboard/`                                                                                     |
| Deep-link to `api-docs` (Swagger)                       | Swagger UI loads and is functional on Vercel                                                                                               |

---

## 9. Feature 7 — npm Package Publishing

### 9.1 User Stories

#### US-7.1: Developer installs HarvestHub globally via npm (P1)

> **As a** developer,
> **I want to** run `npm install -g harvest-hub` and immediately use the `harvest` CLI command,
> **So that** I can start scraping without cloning the repo.

**Acceptance Scenarios:**

```
GIVEN I run `npm install -g harvest-hub`
WHEN the installation completes
THEN the `harvest` command is available in my PATH
  AND `harvest --version` prints the package version
  AND `harvest --help` lists all available commands
```

```
GIVEN I have harvest-hub installed globally
WHEN I run `harvest scrape <url>`
THEN the scraping process starts (assuming Python engine is available)
```

#### US-7.2: Developer imports HarvestHub as a library (P2)

> **As a** developer building a custom scraping pipeline,
> **I want to** `import { createServer, exportProducts } from "harvest-hub"`,
> **So that** I can use HarvestHub's functionality programmatically.

**Acceptance Scenarios:**

```
GIVEN I install harvest-hub as a dependency in my project
WHEN I import from "harvest-hub"
THEN I get typed exports for the public API
  AND TypeScript autocompletion works with the provided type declarations
```

#### US-7.3: Maintainer publishes a new version (P2)

> **As a** maintainer,
> **I want** `npm pack` to produce a clean tarball with only the necessary files,
> **So that** the published package is small and doesn't include test files, configs, or development artifacts.

**Acceptance Scenarios:**

```
GIVEN I run `npm pack --dry-run`
WHEN the output lists files
THEN it includes: dist/**, package.json, README.md, LICENSE
  AND it excludes: src/**, node_modules/**, coverage/**, e2e/**, dashboard/**, .github/**, engine/**
  AND the total packed size is under 500KB
```

### 9.2 Functional Requirements

| ID      | Requirement                                                                                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-7.01 | `package.json` `name` SHALL remain `"harvest-hub"`                                                                                                                                                                          |
| FR-7.02 | `package.json` SHALL include `"bin": { "harvest": "dist/cli/index.js" }` (already present — preserve)                                                                                                                       |
| FR-7.03 | `package.json` SHALL include `"files": ["dist", "README.md", "LICENSE"]` to whitelist published files                                                                                                                       |
| FR-7.04 | `package.json` SHALL include `"main": "dist/index.js"` pointing to the public API entry                                                                                                                                     |
| FR-7.05 | `package.json` SHALL include `"types": "dist/index.d.ts"` for TypeScript consumers                                                                                                                                          |
| FR-7.06 | `package.json` SHALL include `"engines": { "node": ">=20.0.0" }`                                                                                                                                                            |
| FR-7.07 | `package.json` SHALL include `"keywords": ["scraper", "web-scraping", "e-commerce", "product-data", "harvest", "cli", "export", "xlsx", "csv", "google-merchant"]`                                                          |
| FR-7.08 | `package.json` SHALL include `"repository": { "type": "git", "url": "https://github.com/SufficientDaikon/harvesthub.git" }`                                                                                                 |
| FR-7.09 | `package.json` SHALL include `"homepage": "https://github.com/SufficientDaikon/harvesthub"`                                                                                                                                 |
| FR-7.10 | `package.json` SHALL include `"license": "MIT"`                                                                                                                                                                             |
| FR-7.11 | A public API entry file SHALL be created at `src/index.ts` that re-exports key modules: `createServer` from `./api/server.js`, `exportProducts` and `SUPPORTED_FORMATS` from `./export/index.js`, key types from `./types/` |
| FR-7.12 | `src/cli/index.ts` SHALL retain its existing shebang line `#!/usr/bin/env node` (already present — preserve)                                                                                                                |
| FR-7.13 | `tsconfig.json` SHALL include `"declaration": true` so `.d.ts` files are generated during build                                                                                                                             |
| FR-7.14 | An npm badge SHALL be added to `README.md`: `[![npm](https://img.shields.io/npm/v/harvest-hub?color=10B981)](https://www.npmjs.com/package/harvest-hub)`                                                                    |
| FR-7.15 | A `prepublishOnly` script SHALL be added to `package.json`: `"prepublishOnly": "npm run build && npm test"` to ensure quality before publishing                                                                             |

### 9.3 Edge Cases

| Case                                             | Expected Behavior                                                                                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User installs globally without Python            | CLI starts, commands that need Python engine print a user-friendly error: "Python scraping engine not found. Run: pip install -r engine/requirements.txt" |
| User imports from "harvest-hub" in a CJS project | Since package uses `"type": "module"`, CJS projects must use dynamic `import()`. The README should note this requirement                                  |
| `dist/` not built before `npm pack`              | `prepublishOnly` script runs build automatically                                                                                                          |
| Conflicting npm package name                     | `harvest-hub` — verify availability. If taken, use scoped name `@harvesthub/cli`                                                                          |

---

## 10. Feature 8 — Chrome Extension

### 10.1 User Stories

#### US-8.1: User scrapes current page from browser (P1)

> **As a** user browsing an e-commerce product page,
> **I want to** click the HarvestHub extension icon and scrape the current page,
> **So that** I can extract product data without leaving my browser or using the CLI.

**Acceptance Scenarios:**

```
GIVEN I am on an e-commerce product page (e.g., amazon.com/dp/...)
  AND HarvestHub API is running at my configured endpoint
WHEN I click the HarvestHub extension icon
THEN a popup opens showing the current page URL
  AND I see a "Scrape This Page" button
```

```
GIVEN the popup is open with a product URL displayed
WHEN I click "Scrape This Page"
THEN the extension sends the URL to the HarvestHub API
  AND a loading indicator is shown
  AND on success, the extracted product data (title, price, image) is displayed in the popup
  AND a "Copy JSON" button allows me to copy the result to clipboard
```

```
GIVEN the API is not reachable
WHEN I click "Scrape This Page"
THEN the popup shows an error message: "Cannot reach HarvestHub API at [endpoint]. Check that the server is running."
  AND a link to the options page is shown
```

#### US-8.2: User configures API endpoint (P1)

> **As a** user running HarvestHub locally on a custom port,
> **I want to** configure the API endpoint in the extension settings,
> **So that** the extension connects to my running instance.

**Acceptance Scenarios:**

```
GIVEN I right-click the extension icon and select "Options" (or click settings icon in popup)
WHEN the options page opens
THEN I see an input field pre-populated with the default endpoint: "http://localhost:3000"
  AND a "Save" button
  AND a "Test Connection" button
```

```
GIVEN I enter "http://localhost:4000" and click "Test Connection"
WHEN the extension sends a GET /api/health request
THEN it shows a green checkmark and "Connected!" if successful
  OR a red X and "Connection failed" if not reachable
```

```
GIVEN I save a new endpoint
WHEN I open the popup next time
THEN it uses the saved endpoint for API calls
```

### 10.2 Functional Requirements

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-8.01 | An `extension/` directory SHALL be created at the repository root                                                                                                                                                                                                                                                                                                                                                                                                     |
| FR-8.02 | `extension/manifest.json` SHALL be a valid Manifest V3 Chrome extension manifest with: `manifest_version: 3`, `name: "HarvestHub"`, `version: "1.0.0"`, `description: "Scrape product data from any e-commerce page"`, `permissions: ["activeTab", "storage"]`, `action.default_popup: "popup.html"`, `options_page: "options.html"`                                                                                                                                  |
| FR-8.03 | `extension/manifest.json` SHALL define icons at sizes 16, 48, and 128 using SVG-derived PNG files or inline SVG references                                                                                                                                                                                                                                                                                                                                            |
| FR-8.04 | Extension icons SHALL use a HarvestHub-themed design (wheat/harvest motif or stylized "H") in emerald (`#10B981`) on transparent background                                                                                                                                                                                                                                                                                                                           |
| FR-8.05 | `extension/popup.html` SHALL render a popup (width: 360px, min-height: 480px) with: (a) HarvestHub logo/title header; (b) current page URL (truncated to 50 chars with full URL on hover); (c) "Scrape This Page" primary action button; (d) results area showing extracted product data (title, price, image thumbnail, availability); (e) "Copy JSON" button for copying raw scrape result; (f) loading state with spinner; (g) error state with actionable message |
| FR-8.06 | `extension/popup.js` SHALL: (a) Query the active tab URL using `chrome.tabs.query`; (b) Load the saved API endpoint from `chrome.storage.sync` (default: `http://localhost:3000`); (c) On "Scrape" button click, POST to `{endpoint}/api/scrape` with the URL; (d) Display results or errors in the popup DOM                                                                                                                                                         |
| FR-8.07 | `extension/popup.html` and `extension/popup.js` SHALL use the HarvestHub dark theme: background `#0F172A`, card background `#1a2539`, text `#E2E8F0`, accent `#10B981`, font-family matching the dashboard                                                                                                                                                                                                                                                            |
| FR-8.08 | `extension/options.html` SHALL render a settings page with: (a) "API Endpoint" text input (default: `http://localhost:3000`); (b) "Test Connection" button; (c) "Save" button; (d) Connection status indicator (green checkmark / red X with message)                                                                                                                                                                                                                 |
| FR-8.09 | `extension/options.js` SHALL: (a) Load saved endpoint from `chrome.storage.sync` on page load; (b) On "Test Connection", send GET to `{endpoint}/api/health` and display result; (c) On "Save", persist endpoint to `chrome.storage.sync` and show confirmation                                                                                                                                                                                                       |
| FR-8.10 | All extension scripts SHALL be plain JavaScript (no build step, no bundler, no TypeScript) for simplicity and auditability                                                                                                                                                                                                                                                                                                                                            |
| FR-8.11 | The extension SHALL NOT request broad permissions like `"<all_urls>"` or `"tabs"` — only `"activeTab"` (grants access to current tab on click) and `"storage"` (for saving settings)                                                                                                                                                                                                                                                                                  |
| FR-8.12 | SVG icon source files SHALL be created at `extension/icons/icon.svg` and static PNG renders at `extension/icons/icon-16.png`, `extension/icons/icon-48.png`, `extension/icons/icon-128.png`                                                                                                                                                                                                                                                                           |
| FR-8.13 | `README.md` SHALL include a "Chrome Extension" section with: (a) what it does; (b) installation steps (load unpacked from `extension/` directory); (c) screenshot or description of the popup; (d) configuration instructions                                                                                                                                                                                                                                         |
| FR-8.14 | The popup SHALL handle CORS errors gracefully — if the API doesn't include the extension's origin in CORS headers, display a message explaining how to configure CORS or use `http://localhost`                                                                                                                                                                                                                                                                       |
| FR-8.15 | The extension popup SHALL display a "View in Dashboard" link that opens `{endpoint}/dashboard` in a new tab                                                                                                                                                                                                                                                                                                                                                           |

### 10.3 Edge Cases

| Case                                                           | Expected Behavior                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| User clicks extension on a non-product page (e.g., google.com) | Scrape runs; API returns low-confidence results or empty data; popup shows "No product data detected on this page" |
| API endpoint is `https://` but running on `http://`            | Connection test fails; error message suggests checking http vs https                                               |
| Popup opened when API is down                                  | Clear error: "Cannot connect to HarvestHub API. Is the server running?"                                            |
| Very long product title in results                             | Title truncated with ellipsis; full title shown on hover                                                           |
| User has never configured endpoint                             | Default `http://localhost:3000` is used                                                                            |
| Manifest V2 browser (old Chrome)                               | Extension won't install; this is expected — Manifest V3 minimum                                                    |
| Multiple scrape clicks in rapid succession                     | Button is disabled during scrape; re-enabled on completion/error                                                   |
| `chrome.storage.sync` quota exceeded                           | Extremely unlikely with one string stored; no special handling needed                                              |

---

## 11. Cross-Cutting Concerns

### 11.1 README.md Modifications Summary

The following changes SHALL be made to `README.md` in a coordinated update:

| Location                                   | Change                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Badge row                                  | Add Codecov badge (FR-4.09), npm badge (FR-7.14); update test count from 111 to 140 (FR-4.10) |
| After badges, before "What is HarvestHub?" | Insert terminal demo SVG (FR-1.10)                                                            |
| Quick Start or new Deployment section      | Add "Deploy to Vercel" button (FR-6.08)                                                       |
| New section: "Chrome Extension"            | Installation and usage instructions (FR-8.13)                                                 |
| Existing or new section: "Contributing"    | Link to `CONTRIBUTING.md` (FR-5.02)                                                           |

### 11.2 Package.json Modifications Summary

| Field                    | Current             | Target                                                                           |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------- |
| `main`                   | `dist/cli/index.js` | `dist/index.js`                                                                  |
| `types`                  | _(missing)_         | `dist/index.d.ts`                                                                |
| `files`                  | _(missing)_         | `["dist", "README.md", "LICENSE"]`                                               |
| `engines`                | _(missing)_         | `{ "node": ">=20.0.0" }`                                                         |
| `keywords`               | _(missing)_         | `["scraper", "web-scraping", "e-commerce", ...]`                                 |
| `repository`             | _(missing)_         | `{ "type": "git", "url": "https://github.com/SufficientDaikon/harvesthub.git" }` |
| `homepage`               | _(missing)_         | `https://github.com/SufficientDaikon/harvesthub`                                 |
| `license`                | _(missing)_         | `MIT`                                                                            |
| `scripts.test:coverage`  | _(missing)_         | `vitest run --coverage`                                                          |
| `scripts.prepublishOnly` | _(missing)_         | `npm run build && npm test`                                                      |
| `devDependencies`        | _(no coverage)_     | Add `@vitest/coverage-v8`                                                        |

### 11.3 CI Workflow Modifications Summary

| Step            | Current                                       | Target                                      |
| --------------- | --------------------------------------------- | ------------------------------------------- |
| System deps     | _(missing)_                                   | Add `apt-get install` for native build deps |
| Python install  | Direct pip install                            | Add `continue-on-error: true`               |
| Build step      | _(missing)_                                   | Add `npx tsc` before test step              |
| Test step       | `npx vitest run`                              | `npx vitest run --coverage`                 |
| Coverage upload | _(missing)_                                   | Add `codecov/codecov-action@v4` step        |
| Playwright      | `npx playwright install --with-deps chromium` | Keep as-is                                  |

### 11.4 Non-Functional Requirements

| ID     | Requirement                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| NFR-01 | All new files SHALL pass TypeScript strict mode compilation with zero errors                                     |
| NFR-02 | All 140 existing vitest tests SHALL continue to pass after all changes                                           |
| NFR-03 | The marketing page (EN and AR) SHALL score ≥90 on Lighthouse Performance audit after calculator addition         |
| NFR-04 | The Chrome extension popup SHALL load in under 200ms                                                             |
| NFR-05 | The demo SVG SHALL load in under 100ms on a 3G connection (< 50KB)                                               |
| NFR-06 | All new Markdown files SHALL render correctly on GitHub (no broken formatting)                                   |
| NFR-07 | The `npm pack` tarball SHALL be under 500KB                                                                      |
| NFR-08 | All new user-facing text in the Chrome extension and calculator SHALL be free of typos and grammatically correct |
| NFR-09 | The extension popup SHALL be usable with keyboard navigation (tab order, enter to activate buttons)              |
| NFR-10 | The cost calculator SHALL work in Chrome, Firefox, Safari, and Edge (latest versions)                            |

---

## 12. Assumptions & Dependencies

### Assumptions

| #   | Assumption                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | The GitHub repository is `SufficientDaikon/harvesthub` on branch `master` — all badge URLs and deploy button URLs use this            |
| A2  | The maintainer will create a Codecov account and add `CODECOV_TOKEN` to GitHub repository secrets                                     |
| A3  | The npm package name `harvest-hub` is available on the npm registry (or the maintainer has publishing rights to it)                   |
| A4  | The Express API's `POST /api/scrape` endpoint accepts a JSON body with a `url` field (used by Chrome extension)                       |
| A5  | The `api/health` endpoint exists and returns a 200 OK when the server is running (used by Chrome extension connection test)           |
| A6  | Python `scrapling` and `curl_cffi` may fail to compile on Ubuntu CI without additional system packages — the CI fix accounts for this |
| A7  | The dashboard is already deployed on GitHub Pages and will continue to be served from the `dashboard/` directory                      |
| A8  | The existing `api/index.ts` Vercel adapter works — the spec refines it but does not require a full rewrite                            |
| A9  | `tsconfig.json` currently does NOT include `"declaration": true` — this needs to be added for npm types                               |

### Dependencies

| #   | Dependency                                | Required By                     |
| --- | ----------------------------------------- | ------------------------------- |
| D1  | `@vitest/coverage-v8` npm package         | Feature 4 (Coverage)            |
| D2  | `codecov/codecov-action@v4` GitHub Action | Feature 4 (CI coverage upload)  |
| D3  | Codecov account + token                   | Feature 4 (badge and reporting) |
| D4  | Vercel account                            | Feature 6 (deployment)          |
| D5  | npm registry account                      | Feature 7 (publishing)          |
| D6  | Chrome browser ≥ 88 (Manifest V3 support) | Feature 8 (extension)           |

---

## 13. Out of Scope

The following are explicitly **NOT** part of this specification:

| #    | Item                                              | Rationale                                                                                   |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| OS1  | Firefox/Safari extension versions                 | Chrome-only for v1; browser extension APIs differ significantly                             |
| OS2  | Chrome Web Store publishing                       | Requires developer account, review process; manual step for maintainer                      |
| OS3  | Automated npm publish via CI                      | Requires npm token in secrets; manual publish is safer for v1                               |
| OS4  | E2E tests for the Chrome extension                | Extension testing requires specialized tooling (Puppeteer with extension loading); deferred |
| OS5  | Coverage thresholds / gates                       | Adding coverage measurement is in scope; enforcing minimums is not                          |
| OS6  | i18n framework for extension                      | Extension is English-only for v1                                                            |
| OS7  | Cost calculator backend (saving/emailing results) | Calculator is purely client-side                                                            |
| OS8  | Redesigning existing README sections              | Only additive changes and badge updates; no restructuring                                   |
| OS9  | Docker deployment button                          | Only Vercel deploy button is in scope                                                       |
| OS10 | SVG animation generator tooling                   | The demo SVG is hand-crafted; no build tool needed                                          |

---

## 14. Acceptance Checklist

### Spec Self-Validation

- [x] No implementation details (languages/frameworks mentioned only as constraints from existing codebase, not as decisions)
- [x] All requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Zero `[NEEDS CLARIFICATION]` markers remain (all resolved through codebase investigation)
- [x] Every user story has acceptance scenarios in Given/When/Then format
- [x] Edge cases identified for every major flow
- [x] Scope is clearly bounded (in-scope AND out-of-scope documented)
- [x] All functional requirements trace to at least one user story

### Implementation Acceptance Criteria

| ID     | Criterion                                                                                                   | Verification                               |
| ------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| SC-001 | `assets/demo.svg` exists, animates, and is embedded in README                                               | Visual inspection on GitHub                |
| SC-002 | CI pipeline passes on push to master for both Node 20.x and 22.x                                            | Green badge on GitHub                      |
| SC-003 | Cost calculator is interactive and functional on both marketing.html and marketing-ar.html                  | Manual testing in browser                  |
| SC-004 | `npm run test:coverage` generates coverage report; Codecov badge renders in README                          | Run command + visual inspection            |
| SC-005 | `CONTRIBUTING.md`, both issue templates, and PR template exist and render correctly on GitHub               | Navigate to "New Issue" on GitHub          |
| SC-006 | Vercel deployment serves dashboard and API; scrape endpoints return 503; deploy button works                | Click deploy button, test endpoints        |
| SC-007 | `npm pack` produces clean tarball under 500KB; `harvest` CLI works after global install                     | `npm pack --dry-run` + global install test |
| SC-008 | Chrome extension loads unpacked, shows popup, scrapes current page via API, and options page saves endpoint | Load in Chrome, test on product page       |
| SC-009 | All 140 existing vitest tests still pass                                                                    | `npm test`                                 |
| SC-010 | Zero TypeScript compilation errors                                                                          | `npx tsc --noEmit`                         |
| SC-011 | README badges are accurate (test count = 140, CI = passing, coverage shows %, npm version renders)          | Visual inspection                          |

---

## Traceability Matrix

| User Story | Functional Requirements                      | Success Criteria |
| ---------- | -------------------------------------------- | ---------------- |
| US-1.1     | FR-1.01 – FR-1.12                            | SC-001           |
| US-2.1     | FR-2.01 – FR-2.12                            | SC-002           |
| US-2.2     | FR-2.01, FR-2.07, FR-2.08                    | SC-002           |
| US-3.1     | FR-3.01 – FR-3.08, FR-3.10 – FR-3.12         | SC-003           |
| US-3.2     | FR-3.09, FR-3.12                             | SC-003           |
| US-4.1     | FR-4.01 – FR-4.08                            | SC-004           |
| US-4.2     | FR-4.09, FR-4.10                             | SC-004, SC-011   |
| US-5.1     | FR-5.01, FR-5.02, FR-5.07                    | SC-005           |
| US-5.2     | FR-5.03, FR-5.04, FR-5.06                    | SC-005           |
| US-5.3     | FR-5.05, FR-5.06                             | SC-005           |
| US-6.1     | FR-6.01 – FR-6.04, FR-6.08 – FR-6.10         | SC-006           |
| US-6.2     | FR-6.05 – FR-6.07                            | SC-006           |
| US-7.1     | FR-7.01 – FR-7.03, FR-7.06, FR-7.12, FR-7.15 | SC-007           |
| US-7.2     | FR-7.04, FR-7.05, FR-7.11, FR-7.13           | SC-007           |
| US-7.3     | FR-7.03, FR-7.15                             | SC-007           |
| US-8.1     | FR-8.01 – FR-8.07, FR-8.10, FR-8.14, FR-8.15 | SC-008           |
| US-8.2     | FR-8.08, FR-8.09, FR-8.11                    | SC-008           |

---

_End of Specification_
