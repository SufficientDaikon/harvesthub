# Contributing to HarvestHub 🌾

Thank you for your interest in contributing to HarvestHub! We welcome all contributions — bug fixes, features, documentation, tests, and more.

---

## Prerequisites

| Tool        | Version | Required?                   |
| ----------- | ------- | --------------------------- |
| **Node.js** | ≥ 20.x  | ✅ Yes                      |
| **npm**     | ≥ 10.x  | ✅ Yes                      |
| **Python**  | ≥ 3.11  | ⚠️ Only for scraping engine |
| **pip**     | latest  | ⚠️ Only for scraping engine |

> **Note:** If you're contributing to TypeScript code only (API, CLI, exports, tests), you don't need Python installed. All vitest tests mock the Python bridge.

---

## Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-username>/harvesthub.git
cd harvesthub

# 2. Install Node.js dependencies
npm install

# 3. (Optional) Install Python dependencies for the scraping engine
pip install -r engine/requirements.txt

# 4. Verify everything works
npm test          # Run all vitest tests
npm run lint      # Type-check with tsc --noEmit
```

**Windows users** can use the one-command bootstrap:

```powershell
.\setup.ps1
```

---

## Development Workflow

### 1. Create a Branch

Use conventional branch naming:

```bash
git checkout -b feature/my-new-feature    # New feature
git checkout -b fix/broken-export          # Bug fix
git checkout -b docs/update-readme         # Documentation
```

### 2. Make Your Changes

```bash
# Start the dashboard in development mode
npm run dev

# Or run the CLI directly
npx tsx src/cli/index.ts status
```

### 3. Write/Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Type-check
npm run lint
```

### 4. Commit with Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add price history chart to dashboard
fix: handle empty URL list in scrape command
docs: update API endpoint documentation
test: add export pipeline integration tests
chore: update dependencies
```

### 5. Open a Pull Request

- Push your branch to your fork
- Open a PR against `master`
- Fill in the PR template
- Ensure CI passes (tests, type-check, E2E)

---

## Code Style

- **TypeScript strict mode** — no `any` types, no unchecked indexed access
- **ESM imports** — use `import`/`export`, not `require`
- **Zod** for runtime validation of external data
- **Pino** for structured JSON logging
- **Nanoid** for ID generation
- **No `console.log`** — use the logger from `src/lib/logger.ts`

---

## Testing

Tests live in `src/__tests__/` and use [Vitest](https://vitest.dev/).

| Type       | Location                  | Command                 |
| ---------- | ------------------------- | ----------------------- |
| Unit tests | `src/__tests__/*.test.ts` | `npm test`              |
| E2E tests  | `e2e/`                    | `npm run test:e2e`      |
| Coverage   | `coverage/` (generated)   | `npm run test:coverage` |

### Adding Tests

1. Create a test file in `src/__tests__/` named `<feature>.test.ts`
2. Use `describe` / `it` blocks with clear descriptions
3. Mock external dependencies (Python bridge, file system) as needed
4. Aim for meaningful coverage — test behavior, not implementation details

---

## Architecture Overview

```
src/
├── types/        # TypeScript interfaces (Product, Job, Schedule)
├── lib/          # Errors, logger, URL parser/validator
├── core/         # Scrape bridge, rate limiter, retry engine,
│                 # UA pool, proxy pool, scheduler, WS broadcast,
│                 # price differ, job runner
├── pipeline/     # Data normalization
├── store/        # JSON file persistence (atomic writes)
├── export/       # XLSX, CSV, JSON, GMC exporters
├── api/          # Express server + Vercel handler
├── cli/          # Commander.js CLI (7 commands)
├── alerts/       # Alert/notification system
└── __tests__/    # Test files
```

| Directory    | Purpose                                              |
| ------------ | ---------------------------------------------------- |
| `engine/`    | Python Scrapling engine — the actual web scraper     |
| `dashboard/` | Standalone HTML/CSS/JS dashboard and marketing pages |
| `api/`       | Vercel serverless entry point                        |
| `data/`      | Runtime data — product store, exports, logs          |
| `scripts/`   | Utility scripts (migration, etc.)                    |
| `e2e/`       | Playwright end-to-end tests                          |

---

## Reporting Issues

Found a bug or have a feature idea? Please use our issue templates:

- 🐛 [Bug Report](https://github.com/SufficientDaikon/harvesthub/issues/new?template=bug_report.md)
- ✨ [Feature Request](https://github.com/SufficientDaikon/harvesthub/issues/new?template=feature_request.md)

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for helping make HarvestHub better! 🌾
