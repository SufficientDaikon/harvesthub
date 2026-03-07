import { readFile } from "node:fs/promises";
import {
  validateAndDeduplicateUrls,
  type UrlValidationResult,
} from "./url-validator.js";

export async function parseUrlFile(
  filePath: string,
): Promise<UrlValidationResult> {
  const content = await readFile(filePath, "utf-8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return validateAndDeduplicateUrls(lines);
}

export function parseUrlString(input: string): UrlValidationResult {
  const lines = input
    .split(/[\r\n,;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return validateAndDeduplicateUrls(lines);
}
