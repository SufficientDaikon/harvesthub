import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { nanoid } from "nanoid";
import { parseUrlFile, parseUrlString } from "../../lib/url-parser.js";
import { scrapeUrl, checkEngineHealth } from "../../core/scrape-bridge.js";
import { acquireToken } from "../../core/rate-limiter.js";
import { withRetry } from "../../core/retry-engine.js";
import { normalizeProduct } from "../../pipeline/normalizer.js";
import { saveProducts, loadProducts } from "../../store/local-store.js";
import {
  exportProducts,
  type ExportFormat,
  SUPPORTED_FORMATS,
} from "../../export/index.js";
import { createChildLogger } from "../../lib/logger.js";
import { wsBroadcast } from "../../core/ws-broadcast.js";
import type { Product, ScrapeJob, ScrapeTask } from "../../types/index.js";
import { DEFAULT_JOB_CONFIG } from "../../types/index.js";

const log = createChildLogger("scrape-cmd");

export const scrapeCommand = new Command("scrape")
  .description("Scrape product data from URLs")
  .option("-u, --urls <file>", "Path to URL file (.txt, one URL per line)")
  .option("-i, --input <urls>", "Comma-separated URLs")
  .option(
    "-o, --output <path>",
    "Output file path",
    "data/exports/products.xlsx",
  )
  .option(
    "-f, --format <format>",
    `Export format (${SUPPORTED_FORMATS.join(", ")})`,
    "xlsx",
  )
  .option("-r, --retries <n>", "Max retries per URL", "3")
  .option("-c, --concurrency <n>", "Concurrent domain limit", "3")
  .option("-t, --timeout <ms>", "Request timeout in ms", "30000")
  .option(
    "--stealth",
    "Use stealth mode (slower, bypasses more protection)",
    false,
  )
  .option("--no-export", "Skip export, just scrape and store")
  .option("--dry-run", "Validate URLs without scraping")
  .action(async (opts) => {
    const startTime = Date.now();
    console.log(
      chalk.bold.hex("#1A1A2E")("\n  🌾 HarvestHub Scraper v1.0.0\n"),
    );

    // 1. Validate engine
    const healthSpinner = ora("Checking Python engine...").start();
    const healthy = await checkEngineHealth();
    if (!healthy) {
      healthSpinner.fail(
        "Python engine not available. Run: pip install scrapling",
      );
      console.log(chalk.dim("  Tip: pip install -r engine/requirements.txt"));
      process.exit(1);
    }
    healthSpinner.succeed("Python engine ready");

    // 2. Parse URLs
    let urls: string[];
    const urlSpinner = ora("Parsing URLs...").start();

    if (opts.urls) {
      const result = await parseUrlFile(opts.urls);
      urls = result.valid;
      if (result.invalid.length > 0) {
        urlSpinner.warn(`${result.invalid.length} invalid URLs skipped`);
        for (const inv of result.invalid.slice(0, 5)) {
          console.log(chalk.dim(`  ✗ ${inv.url} — ${inv.reason}`));
        }
      }
      if (result.duplicatesRemoved > 0) {
        console.log(
          chalk.dim(`  ${result.duplicatesRemoved} duplicates removed`),
        );
      }
    } else if (opts.input) {
      const result = parseUrlString(opts.input);
      urls = result.valid;
    } else {
      urlSpinner.fail(
        "No URLs provided. Use --urls <file> or --input <url1,url2>",
      );
      process.exit(1);
    }

    urlSpinner.succeed(`${urls.length} URLs to scrape`);

    if (urls.length === 0) {
      console.log(
        chalk.yellow("\n  No valid URLs found. Nothing to scrape.\n"),
      );
      process.exit(0);
    }

    // Dry run: just validate
    if (opts.dryRun) {
      console.log(chalk.green("\n  Dry run complete. URLs validated.\n"));
      for (const url of urls) console.log(chalk.dim(`  ✓ ${url}`));
      process.exit(0);
    }

    // 3. Scrape
    const products: Product[] = [];
    const errors: Array<{ url: string; error: string }> = [];
    const maxRetries = parseInt(opts.retries, 10);
    const timeout = parseInt(opts.timeout, 10);
    const useStealth = opts.stealth;

    console.log(
      chalk.dim(
        `\n  Config: retries=${maxRetries}, timeout=${timeout}ms, stealth=${useStealth}\n`,
      ),
    );

    wsBroadcast.emit("scrape:start", {
      total: urls.length,
      config: { maxRetries, timeout, useStealth },
    });

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!;
      const prefix = chalk.dim(`  [${i + 1}/${urls.length}]`);
      const spinner = ora({ text: `${prefix} ${url}`, prefixText: "" }).start();

      try {
        await acquireToken(url);

        const result = await withRetry(
          () => scrapeUrl(url, { timeout, useStealth }),
          { maxRetries },
        );

        if (!result.success || !result.data) {
          const lastErr = result.errors.at(-1)?.message ?? "Unknown error";
          spinner.fail(`${prefix} ${chalk.red("FAIL")} ${url}`);
          console.log(
            chalk.dim(`         ${lastErr} (${result.attempts} attempts)`),
          );
          errors.push({ url, error: lastErr });
          wsBroadcast.emit("scrape:progress", {
            index: i + 1,
            total: urls.length,
            url,
            status: "fail",
            error: lastErr,
          });
          continue;
        }

        const response = result.data;

        if (!response.is_product_page) {
          spinner.warn(`${prefix} ${chalk.yellow("SKIP")} Not a product page`);
          wsBroadcast.emit("scrape:progress", {
            index: i + 1,
            total: urls.length,
            url,
            status: "skip",
            reason: "not_product_page",
          });
          continue;
        }

        if (!response.product) {
          spinner.warn(`${prefix} ${chalk.yellow("SKIP")} No data extracted`);
          wsBroadcast.emit("scrape:progress", {
            index: i + 1,
            total: urls.length,
            url,
            status: "skip",
            reason: "no_data",
          });
          continue;
        }

        const normalized = normalizeProduct(response.product, url);
        const product: Product = {
          id: nanoid(12),
          sourceUrl: url,
          scrapedAt: new Date().toISOString(),
          title: normalized.title ?? "",
          price: normalized.price ?? 0,
          currency: normalized.currency ?? "",
          description: normalized.description ?? null,
          images: normalized.images ?? [],
          availability: normalized.availability ?? "unknown",
          brand: normalized.brand ?? null,
          sku: normalized.sku ?? null,
          mpn: normalized.mpn ?? null,
          gtin: normalized.gtin ?? null,
          category: normalized.category ?? null,
          rating: normalized.rating ?? null,
          reviewCount: normalized.reviewCount ?? null,
          specifications: normalized.specifications ?? {},
          seller: normalized.seller ?? null,
          shipping: normalized.shipping ?? null,
          alternativePrices: [],
          confidenceScores: normalized.confidenceScores ?? {},
          overallConfidence:
            (normalized as any).overallConfidence ??
            (response.product as any).overall_confidence ??
            50,
          extractionMethod: ((response.product as any).confidence_method ===
          "json-ld"
            ? "adaptive"
            : "adaptive") as any,
          metadata: {},
        };

        products.push(product);
        const confStr =
          product.overallConfidence >= 80
            ? chalk.green(`${product.overallConfidence}%`)
            : product.overallConfidence >= 50
              ? chalk.yellow(`${product.overallConfidence}%`)
              : chalk.red(`${product.overallConfidence}%`);
        spinner.succeed(
          `${prefix} ${chalk.green("OK")} ${product.title.slice(0, 50)} — ${confStr} — ${response.elapsed_ms}ms`,
        );
        wsBroadcast.emit("scrape:progress", {
          index: i + 1,
          total: urls.length,
          url,
          status: "ok",
          title: product.title,
          price: product.price,
          currency: product.currency,
          confidence: product.overallConfidence,
          elapsedMs: response.elapsed_ms,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        spinner.fail(`${prefix} ${chalk.red("ERROR")} ${url}`);
        console.log(chalk.dim(`         ${msg}`));
        errors.push({ url, error: msg });
        wsBroadcast.emit("scrape:error", {
          index: i + 1,
          total: urls.length,
          url,
          error: msg,
        });
      }
    }

    // 4. Save
    if (products.length > 0) {
      const saveSpinner = ora("Saving products to store...").start();
      await saveProducts(products);
      saveSpinner.succeed(`${products.length} products saved to store`);
    }

    // 5. Export
    if (products.length > 0 && opts.export !== false) {
      const format = opts.format as ExportFormat;
      const exportSpinner = ora(
        `Exporting ${products.length} products as ${format}...`,
      ).start();
      try {
        const path = await exportProducts(products, opts.output, format);
        exportSpinner.succeed(`Exported to ${chalk.underline(path)}`);
      } catch (err) {
        exportSpinner.fail(
          `Export failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // 6. Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.bold("\n  ───────────────────────────────"));
    console.log(chalk.bold("  📊 Scrape Summary"));
    console.log(chalk.bold("  ───────────────────────────────"));
    console.log(`  Total URLs:     ${urls.length}`);
    console.log(`  ${chalk.green("Succeeded:")}     ${products.length}`);
    console.log(`  ${chalk.red("Failed:")}        ${errors.length}`);
    console.log(`  Time:           ${elapsed}s`);
    console.log(chalk.bold("  ───────────────────────────────\n"));

    wsBroadcast.emit("scrape:complete", {
      total: urls.length,
      succeeded: products.length,
      failed: errors.length,
      elapsedSec: parseFloat(elapsed),
    });

    if (errors.length > 0 && errors.length <= 10) {
      console.log(chalk.dim("  Failed URLs:"));
      for (const e of errors) {
        console.log(chalk.dim(`    ✗ ${e.url}`));
        console.log(chalk.dim(`      ${e.error}`));
      }
      console.log("");
    }
  });
