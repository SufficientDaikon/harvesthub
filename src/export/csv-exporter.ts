import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Product } from "../types/index.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("csv-exporter");

const CSV_HEADERS = [
  "id",
  "title",
  "price",
  "currency",
  "availability",
  "brand",
  "sku",
  "mpn",
  "gtin",
  "category",
  "description",
  "rating",
  "reviewCount",
  "images",
  "overallConfidence",
  "sourceUrl",
  "scrapedAt",
];

function escapeField(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportCsv(
  products: Product[],
  outputPath: string,
): Promise<string> {
  const BOM = "\uFEFF";
  const lines: string[] = [CSV_HEADERS.join(",")];

  for (const p of products) {
    const row = [
      p.id,
      p.title,
      p.price,
      p.currency,
      p.availability,
      p.brand ?? "",
      p.sku ?? "",
      p.mpn ?? "",
      p.gtin ?? "",
      p.category ?? "",
      (p.description ?? "").slice(0, 500),
      p.rating ?? "",
      p.reviewCount ?? "",
      p.images.join(" | "),
      p.overallConfidence,
      p.sourceUrl,
      p.scrapedAt,
    ].map(escapeField);
    lines.push(row.join(","));
  }

  const fullPath = resolve(outputPath);
  await writeFile(fullPath, BOM + lines.join("\n"), "utf-8");
  log.info({ path: fullPath, count: products.length }, "CSV export complete");
  return fullPath;
}
