import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { nanoid } from "nanoid";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { saveProducts } from "../../store/local-store.js";
import type { Product } from "../../types/index.js";

const LEGACY_PATH = resolve(process.cwd(), "export_all.py");

export const migrateCommand = new Command("migrate")
  .description("Import legacy data from export_all.py into HarvestHub store")
  .option("--source <path>", "Path to legacy export_all.py", LEGACY_PATH)
  .action(async (opts) => {
    console.log(
      chalk.bold.hex("#1A1A2E")("\n  🌾 HarvestHub Legacy Migration\n"),
    );

    const sourcePath = resolve(opts.source);
    if (!existsSync(sourcePath)) {
      console.log(chalk.red(`  ✗ File not found: ${sourcePath}`));
      process.exit(1);
    }

    const spinner = ora("Parsing legacy export_all.py...").start();

    try {
      const content = await readFile(sourcePath, "utf-8");
      const products = extractLegacyProducts(content);

      if (products.length === 0) {
        spinner.fail("No products found in legacy file");
        process.exit(1);
      }

      spinner.text = `Saving ${products.length} products to store...`;
      await saveProducts(products);

      spinner.succeed(
        `Migrated ${chalk.bold(String(products.length))} products from legacy file`,
      );
      console.log(
        chalk.green(
          "\n  ✓ Migration complete. Run `harvest export` to generate files.\n",
        ),
      );
    } catch (err) {
      spinner.fail(
        `Migration failed: ${err instanceof Error ? err.message : err}`,
      );
      process.exit(1);
    }
  });

function extractLegacyProducts(content: string): Product[] {
  const products: Product[] = [];

  // Extract GMC_ROWS array entries using regex
  // Each row is: ["id", "title", "desc", "link", "image_link", "availability", "price", "brand", "condition", "gtin", "mpn", "identifier_exists", "google_product_category", "product_type"]
  const rowRegex =
    /\["([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)","([^"]*?)"\]/g;

  let match: RegExpExecArray | null;
  let inGmcRows = false;
  const lines = content.split("\n");

  for (const line of lines) {
    if (line.includes("GMC_ROWS")) inGmcRows = true;
    if (line.includes("ADS_") && inGmcRows) inGmcRows = false;

    if (!inGmcRows) continue;

    // Reset regex lastIndex for each line
    rowRegex.lastIndex = 0;
    match = rowRegex.exec(line);

    if (match) {
      const [
        ,
        id,
        title,
        description,
        link,
        imageLink,
        availability,
        price,
        brand,
        ,
        gtin,
        mpn,
        ,
        category,
        productType,
      ] = match;

      // Parse price
      const priceMatch = (price ?? "").match(/([\d,.]+)/);
      const priceNum = priceMatch
        ? parseFloat(priceMatch[1]!.replace(/,/g, ""))
        : 0;
      const currencyMatch = (price ?? "").match(/([A-Z]{3})/);
      const currency = currencyMatch ? currencyMatch[1]! : "";

      const product: Product = {
        id: id ?? nanoid(12),
        sourceUrl: link ?? "",
        scrapedAt: new Date().toISOString(),
        title: title ?? "",
        price: priceNum,
        currency,
        description: description ?? null,
        images: imageLink ? [imageLink] : [],
        availability: (availability === "in_stock"
          ? "in_stock"
          : availability === "out_of_stock"
            ? "out_of_stock"
            : "unknown") as any,
        brand: brand || null,
        sku: id ?? null,
        mpn: mpn || null,
        gtin: gtin || null,
        category: category || productType || null,
        rating: null,
        reviewCount: null,
        specifications: {},
        seller: null,
        shipping: null,
        alternativePrices: [],
        confidenceScores: {},
        overallConfidence: 100,
        extractionMethod: "template",
        metadata: { source: "legacy-migration" },
      };

      products.push(product);
    }
  }

  return products;
}
