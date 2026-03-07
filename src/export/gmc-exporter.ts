import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Product } from "../types/index.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("gmc-exporter");

const GMC_HEADERS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "availability",
  "price",
  "brand",
  "condition",
  "gtin",
  "mpn",
  "identifier_exists",
  "google_product_category",
  "product_type",
];

function escapeTsv(value: string): string {
  return value.replace(/\t/g, " ").replace(/\n/g, " ").replace(/\r/g, "");
}

function mapAvailability(avail: string): string {
  switch (avail) {
    case "in_stock":
      return "in_stock";
    case "out_of_stock":
      return "out_of_stock";
    case "pre_order":
      return "preorder";
    default:
      return "out_of_stock";
  }
}

export interface GmcWarning {
  productId: string;
  field: string;
  message: string;
}

export async function exportGmc(
  products: Product[],
  outputPath: string,
): Promise<{ path: string; warnings: GmcWarning[] }> {
  const warnings: GmcWarning[] = [];
  const lines: string[] = [GMC_HEADERS.join("\t")];

  for (const p of products) {
    // Validate required fields
    if (!p.title)
      warnings.push({
        productId: p.id,
        field: "title",
        message: "Title is required",
      });
    if (!p.price)
      warnings.push({
        productId: p.id,
        field: "price",
        message: "Price is required",
      });
    if (!p.images.length)
      warnings.push({
        productId: p.id,
        field: "image_link",
        message: "At least one image is required",
      });
    if (p.title && p.title.length > 150)
      warnings.push({
        productId: p.id,
        field: "title",
        message: `Title too long (${p.title.length}/150)`,
      });

    const hasIdentifier = !!(p.gtin || p.mpn);
    const priceStr = p.price
      ? `${p.price.toFixed(2)} ${p.currency || "USD"}`
      : "";

    const row = [
      p.sku || p.id,
      escapeTsv((p.title ?? "").slice(0, 150)),
      escapeTsv((p.description ?? "").slice(0, 5000)),
      p.sourceUrl,
      p.images[0] ?? "",
      mapAvailability(p.availability),
      priceStr,
      p.brand ?? "",
      "new",
      p.gtin ?? "",
      p.mpn ?? "",
      hasIdentifier ? "yes" : "no",
      p.category ?? "",
      p.category ?? "",
    ];

    lines.push(row.join("\t"));
  }

  const fullPath = resolve(outputPath);
  await writeFile(fullPath, lines.join("\n"), "utf-8");
  log.info(
    { path: fullPath, count: products.length, warnings: warnings.length },
    "GMC feed export complete",
  );
  return { path: fullPath, warnings };
}
