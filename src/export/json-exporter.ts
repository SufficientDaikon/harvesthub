import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Product } from "../types/index.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("json-exporter");

export interface JsonExportMeta {
  exportedAt: string;
  totalProducts: number;
  generator: string;
  version: string;
}

export async function exportJson(
  products: Product[],
  outputPath: string,
): Promise<string> {
  const output = {
    meta: {
      exportedAt: new Date().toISOString(),
      totalProducts: products.length,
      generator: "HarvestHub",
      version: "1.0.0",
    } satisfies JsonExportMeta,
    products,
  };

  const fullPath = resolve(outputPath);
  await writeFile(fullPath, JSON.stringify(output, null, 2), "utf-8");
  log.info({ path: fullPath, count: products.length }, "JSON export complete");
  return fullPath;
}
