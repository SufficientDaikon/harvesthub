/**
 * Programmatic scrape job runner — used by both the CLI command and the scheduler.
 * No chalk/ora/spinner output; results are returned as data.
 */
import { nanoid } from "nanoid";
import { scrapeUrl } from "./scrape-bridge.js";
import { acquireToken } from "./rate-limiter.js";
import { withRetry } from "./retry-engine.js";
import { wsBroadcast } from "./ws-broadcast.js";
import { normalizeProduct } from "../pipeline/normalizer.js";
import { saveProducts } from "../store/local-store.js";
import { createChildLogger } from "../lib/logger.js";
import type { Product } from "../types/index.js";

const log = createChildLogger("job-runner");

export interface RunJobOptions {
  maxRetries?: number;
  timeout?: number;
  useStealth?: boolean;
}

export interface JobResult {
  products: Product[];
  errors: Array<{ url: string; error: string }>;
  elapsedMs: number;
}

export async function runScrapeJob(
  urls: string[],
  opts: RunJobOptions = {},
): Promise<JobResult> {
  const { maxRetries = 3, timeout = 30_000, useStealth = false } = opts;
  const startTime = Date.now();
  const products: Product[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  wsBroadcast.emit("scrape:start", {
    total: urls.length,
    config: { maxRetries, timeout, useStealth },
  });

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;

    try {
      await acquireToken(url);

      const result = await withRetry(
        () => scrapeUrl(url, { timeout, useStealth }),
        { maxRetries },
      );

      if (!result.success || !result.data) {
        const lastErr = result.errors.at(-1)?.message ?? "Unknown error";
        log.warn({ url, err: lastErr }, "Scrape failed");
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
        extractionMethod: "adaptive",
        metadata: {},
      };

      products.push(product);
      log.info(
        { url, title: product.title, confidence: product.overallConfidence },
        "Product scraped",
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
      log.error({ url, err: msg }, "Scrape error");
      errors.push({ url, error: msg });
      wsBroadcast.emit("scrape:error", {
        index: i + 1,
        total: urls.length,
        url,
        error: msg,
      });
    }
  }

  if (products.length > 0) {
    await saveProducts(products);
  }

  const elapsedMs = Date.now() - startTime;

  wsBroadcast.emit("scrape:complete", {
    total: urls.length,
    succeeded: products.length,
    failed: errors.length,
    elapsedSec: parseFloat((elapsedMs / 1000).toFixed(1)),
  });

  return { products, errors, elapsedMs };
}
