import type { Product } from "../types/index.js";
import { exportXlsx } from "./xlsx-exporter.js";
import { exportCsv } from "./csv-exporter.js";
import { exportJson } from "./json-exporter.js";
import { exportGmc } from "./gmc-exporter.js";

export type ExportFormat = "xlsx" | "csv" | "json" | "gmc";

export const SUPPORTED_FORMATS: ExportFormat[] = ["xlsx", "csv", "json", "gmc"];

export async function exportProducts(
  products: Product[],
  outputPath: string,
  format: ExportFormat,
): Promise<string> {
  switch (format) {
    case "xlsx":
      return exportXlsx(products, outputPath);
    case "csv":
      return exportCsv(products, outputPath);
    case "json":
      return exportJson(products, outputPath);
    case "gmc": {
      const result = await exportGmc(products, outputPath);
      return result.path;
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export { exportXlsx, exportCsv, exportJson, exportGmc };
