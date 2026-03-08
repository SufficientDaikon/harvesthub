/**
 * CLI batch command — harvest batch <file>
 * Reads URLs from a file and runs them through the scrape job runner.
 */
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { parseUrlFile } from "../../lib/url-parser.js";
import { runScrapeJob } from "../../core/job-runner.js";
import { checkEngineHealth } from "../../core/scrape-bridge.js";

export const batchCommand = new Command("batch")
  .description("Batch scrape URLs from a file")
  .argument("<file>", "Path to URL file (.txt or .csv, one URL per line)")
  .option("-r, --retries <n>", "Max retries per URL", "3")
  .option("-t, --timeout <ms>", "Request timeout in ms", "30000")
  .action(async (file: string, opts: { retries: string; timeout: string }) => {
    const startTime = Date.now();
    console.log(
      chalk.bold.hex("#1A1A2E")("\n  🌾 HarvestHub Batch Import\n"),
    );

    // 1. Validate engine
    const healthSpinner = ora("Checking Python engine...").start();
    const healthy = await checkEngineHealth();
    if (!healthy) {
      healthSpinner.fail(
        "Python engine not available. Run: pip install scrapling",
      );
      process.exit(1);
    }
    healthSpinner.succeed("Python engine ready");

    // 2. Parse URLs from file
    const urlSpinner = ora(`Reading URLs from ${file}...`).start();
    let urls: string[];
    try {
      const result = await parseUrlFile(file);
      urls = result.valid;
      if (result.invalid.length > 0) {
        urlSpinner.warn(`${result.invalid.length} invalid URLs skipped`);
        for (const inv of result.invalid.slice(0, 5)) {
          console.log(chalk.dim(`  ✗ ${inv.url} — ${inv.reason}`));
        }
      } else {
        urlSpinner.succeed(`${urls.length} URLs parsed`);
      }
      if (result.duplicatesRemoved > 0) {
        console.log(
          chalk.dim(`  ${result.duplicatesRemoved} duplicates removed`),
        );
      }
    } catch (err) {
      urlSpinner.fail(
        `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }

    if (urls.length === 0) {
      console.log(
        chalk.yellow("\n  No valid URLs found. Nothing to scrape.\n"),
      );
      process.exit(0);
    }

    console.log(chalk.dim(`\n  Processing ${urls.length} URLs…\n`));

    // 3. Run batch scrape
    const maxRetries = parseInt(opts.retries, 10);
    const timeout = parseInt(opts.timeout, 10);

    const result = await runScrapeJob(urls, { maxRetries, timeout });

    // 4. Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.bold("\n  ───────────────────────────────"));
    console.log(chalk.bold("  📥 Batch Import Summary"));
    console.log(chalk.bold("  ───────────────────────────────"));
    console.log(`  Total URLs:     ${urls.length}`);
    console.log(`  ${chalk.green("Succeeded:")}     ${result.products.length}`);
    console.log(`  ${chalk.red("Failed:")}        ${result.errors.length}`);
    console.log(`  Time:           ${elapsed}s`);
    console.log(chalk.bold("  ───────────────────────────────\n"));

    if (result.errors.length > 0 && result.errors.length <= 10) {
      console.log(chalk.dim("  Failed URLs:"));
      for (const e of result.errors) {
        console.log(chalk.dim(`    ✗ ${e.url}`));
        console.log(chalk.dim(`      ${e.error}`));
      }
      console.log("");
    }
  });
