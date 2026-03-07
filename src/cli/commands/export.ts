import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { loadProducts } from "../../store/local-store.js";
import {
  exportProducts,
  SUPPORTED_FORMATS,
  type ExportFormat,
} from "../../export/index.js";

export const exportCommand = new Command("export")
  .description("Export stored products to file")
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
  .option("-s, --store <name>", "Store name to read from", "default")
  .action(async (opts) => {
    console.log(chalk.bold.hex("#1A1A2E")("\n  🌾 HarvestHub Export\n"));

    const spinner = ora("Loading products from store...").start();
    const products = await loadProducts(opts.store);

    if (products.length === 0) {
      spinner.fail("No products in store. Run `harvest scrape` first.");
      process.exit(1);
    }

    spinner.succeed(`Loaded ${products.length} products`);

    const format = opts.format as ExportFormat;
    if (!SUPPORTED_FORMATS.includes(format)) {
      console.log(chalk.red(`  Unsupported format: ${format}`));
      console.log(chalk.dim(`  Supported: ${SUPPORTED_FORMATS.join(", ")}`));
      process.exit(1);
    }

    const exportSpinner = ora(`Exporting as ${format}...`).start();
    try {
      const path = await exportProducts(products, opts.output, format);
      exportSpinner.succeed(`Exported to ${chalk.underline(path)}`);
    } catch (err) {
      exportSpinner.fail(
        `Export failed: ${err instanceof Error ? err.message : err}`,
      );
      process.exit(1);
    }

    console.log(chalk.green("\n  ✓ Export complete\n"));
  });
