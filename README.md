# HarvestHub 🌾

**Adaptive product scraping platform with premium exports**

A TypeScript-first scraping platform that uses Python's [Scrapling](https://scrapling.readthedocs.io/) library for adaptive, anti-bot web scraping. Designed to extract product data from any e-commerce site and export to premium-styled Excel, CSV, JSON, or Google Merchant Center feeds.

---

## Features

- **Adaptive Extraction** — JSON-LD → Microdata → CSS heuristics with confidence scoring
- **Anti-Bot Bypass** — Scrapling's StealthyFetcher handles Cloudflare, DataDome, etc.
- **Premium Excel Export** — Dark-themed headers, conditional formatting, hyperlinks, summary sheet
- **Multi-Format Export** — XLSX, CSV, JSON, Google Merchant Center TSV
- **Smart Rate Limiting** — Per-domain token-bucket rate limiter
- **Retry Engine** — Exponential backoff with jitter, error classification (transient/permanent/blocked)
- **User Agent Rotation** — 20 real browser user agents
- **Legacy Migration** — Import existing `export_all.py` data
- **Type-Safe** — Strict TypeScript end-to-end

## Quick Start

```powershell
# 1. Bootstrap everything
.\setup.ps1

# 2. Check system status
npx tsx src/cli/index.ts status

# 3. Scrape products from a URL file
npx tsx src/cli/index.ts scrape --urls urls.txt --output products.xlsx

# 4. Export stored products
npx tsx src/cli/index.ts export -f xlsx -o report.xlsx
npx tsx src/cli/index.ts export -f gmc -o feed.tsv
npx tsx src/cli/index.ts export -f csv -o data.csv
npx tsx src/cli/index.ts export -f json -o data.json
```

## URL File Format

Create a `.txt` file with one URL per line:

```
# Product URLs (lines starting with # are ignored)
https://example.com/product/widget-pro
https://store.example.com/items/gadget-x
https://shop.example.org/p/thingamajig
```

## CLI Commands

| Command                            | Description                                    |
| ---------------------------------- | ---------------------------------------------- |
| `harvest status`                   | Show system status, store stats, engine health |
| `harvest scrape --urls file.txt`   | Scrape products from URL file                  |
| `harvest scrape --input url1,url2` | Scrape specific URLs                           |
| `harvest scrape --stealth`         | Use stealth mode for protected sites           |
| `harvest scrape --dry-run`         | Validate URLs without scraping                 |
| `harvest export -f xlsx`           | Export stored products to Excel                |
| `harvest export -f gmc`            | Export Google Merchant Center feed             |
| `harvest migrate`                  | Import legacy export_all.py data               |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                TypeScript CLI                     │
│  ┌───────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │
│  │ Parse │→│ Rate Limit│→│ Retry  │→│ Bridge   │ │
│  │ URLs  │ │ (domain)  │ │ Engine │ │ (stdin/  │ │
│  └───────┘ └──────────┘ └────────┘ │  stdout)  │ │
│                                     └────┬─────┘ │
│  ┌───────┐ ┌──────────┐ ┌────────┐      │       │
│  │Export │←│ Store    │←│Normalize│←─────┘       │
│  │ XLSX  │ │ (JSON)   │ │ Price  │               │
│  └───────┘ └──────────┘ └────────┘               │
└─────────────────────────────────────────────────┘
                      │
           ┌──────────▼──────────┐
           │   Python Engine     │
           │   (Scrapling)       │
           │                     │
           │  JSON-LD → Micro →  │
           │  CSS → Heuristic    │
           └─────────────────────┘
```

## Project Structure

```
h:\scraper\
├── engine/
│   ├── scraper.py          # Python Scrapling engine
│   └── requirements.txt    # Python dependencies
├── src/
│   ├── types/              # TypeScript interfaces
│   ├── lib/                # Utilities (errors, logger, validators)
│   ├── core/               # Engine (UA pool, rate limiter, retry, bridge)
│   ├── pipeline/           # Data normalization
│   ├── store/              # JSON persistence
│   ├── export/             # XLSX, CSV, JSON, GMC exporters
│   └── cli/                # Commander.js CLI
├── data/
│   ├── store/              # Product database (JSON)
│   ├── logs/               # Application logs
│   └── exports/            # Generated files
├── package.json
├── tsconfig.json
├── setup.ps1               # One-command bootstrap
└── export_all.py           # Legacy file (preserved)
```

## Requirements

- **Node.js** ≥ 18
- **Python** ≥ 3.9
- **pip packages**: scrapling, orjson

## Export Formats

### Excel (XLSX)

Premium-styled workbook with:

- Summary sheet with aggregated stats
- Products sheet with frozen headers, auto-filter
- Conditional formatting (availability, confidence scores)
- Clickable hyperlinks to source URLs

### Google Merchant Center (GMC)

Tab-separated feed compliant with [Google's product data specification](https://support.google.com/merchants/answer/7052112). Includes validation warnings for missing required fields.

### CSV

UTF-8 with BOM for Excel compatibility.

### JSON

Structured export with metadata header.

## License

MIT
