# HarvestHub File Manifest

## Config Files

- `package.json` — npm config, scripts, dependencies
- `tsconfig.json` — TypeScript compiler config
- `.gitignore` — Git ignore rules
- `engine/requirements.txt` — Python dependencies (scrapling, orjson)
- `setup.ps1` — One-command bootstrap script

## TypeScript Source (`src/`)

### Types

- `src/types/index.ts` — Re-exports all types
- `src/types/product.ts` — Product interface, ConfidenceScores, Availability
- `src/types/job.ts` — ScrapeJob, ScrapeTask, JobConfig, DEFAULT_JOB_CONFIG
- `src/types/schedule.ts` — Schedule interface

### CLI

- `src/cli/index.ts` — Commander.js CLI entry point (5 subcommands)
- `src/cli/commands/scrape.ts` — Main scrape orchestrator
- `src/cli/commands/export.ts` — Export stored products
- `src/cli/commands/status.ts` — System status display
- `src/cli/commands/migrate.ts` — Legacy export_all.py importer
- `src/cli/commands/dashboard.ts` — Start dashboard server

### Core

- `src/core/scrape-bridge.ts` — TypeScript↔Python subprocess JSON IPC
- `src/core/rate-limiter.ts` — Per-domain token-bucket rate limiter
- `src/core/retry-engine.ts` — Exponential backoff with jitter, error classification
- `src/core/ua-pool.ts` — 20 real browser user agents with rotation

### Pipeline

- `src/pipeline/normalizer.ts` — Price/currency/availability normalization

### Store

- `src/store/local-store.ts` — JSON file-based persistence (atomic writes)

### Export

- `src/export/index.ts` — Export router (xlsx/csv/json/gmc)
- `src/export/xlsx-exporter.ts` — Premium Excel export (ExcelJS)
- `src/export/csv-exporter.ts` — CSV with BOM
- `src/export/json-exporter.ts` — Structured JSON
- `src/export/gmc-exporter.ts` — Google Merchant Center TSV

### API

- `src/api/server.ts` — Express.js server (5 endpoints + static)
- `src/api/start.ts` — Standalone server entry point

### Lib

- `src/lib/errors.ts` — HarvestError hierarchy (Transient/Permanent/Blocked)
- `src/lib/logger.ts` — Pino logger with pretty-print
- `src/lib/url-parser.ts` — URL file/string parser
- `src/lib/url-validator.ts` — URL validation + deduplication

### Tests

- `src/__tests__/errors.test.ts`
- `src/__tests__/local-store.test.ts`
- `src/__tests__/normalizer.test.ts`
- `src/__tests__/ua-pool.test.ts`
- `src/__tests__/url-validator.test.ts`

## Python Engine

- `engine/scraper.py` — Scrapling-based adaptive scraper (JSON-LD → Microdata → CSS heuristics)

## Dashboard

- `dashboard/index.html` — SaaS-style product dashboard (dark theme, charts, search, filters)
- `dashboard/docs.html` — Premium editorial documentation/landing page

## Data

- `data/store/default.json` — Product database (104 products)
- `data/exports/` — Generated export files

## Legacy

- `export_all.py` — Original 101-product hardcoded Python file (preserved, not modified)
- `sample-urls.txt` — Sample URLs for testing
- `test-urls.txt` — Quick test URLs (books.toscrape.com)
