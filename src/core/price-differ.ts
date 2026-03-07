/**
 * Price differ — detects price changes when products are re-scraped.
 * Appends to product.priceHistory when the price changes.
 */
import type { Product } from "../types/product.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("price-differ");

export interface PriceChange {
  productId: string;
  url: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  delta: number;
  pctChange: number;
  detectedAt: string;
}

/**
 * Merges an incoming product with the existing stored version.
 * If the price changed, appends the old price to priceHistory and logs the diff.
 * Returns the merged product and optionally a PriceChange record.
 */
export function diffAndMerge(
  existing: Product,
  incoming: Product,
): { merged: Product; change: PriceChange | null } {
  const merged: Product = { ...existing, ...incoming };

  // Preserve existing price history
  merged.priceHistory = existing.priceHistory ?? [];

  if (
    existing.price !== incoming.price &&
    existing.price > 0 &&
    incoming.price > 0
  ) {
    // Record the old price in history
    merged.priceHistory = [
      ...merged.priceHistory,
      {
        price: existing.price,
        currency: existing.currency,
        recordedAt: existing.scrapedAt,
      },
    ];

    const delta = incoming.price - existing.price;
    const pctChange = (delta / existing.price) * 100;

    const change: PriceChange = {
      productId: existing.id,
      url: existing.sourceUrl,
      title: existing.title,
      oldPrice: existing.price,
      newPrice: incoming.price,
      currency: incoming.currency || existing.currency,
      delta,
      pctChange: Math.round(pctChange * 100) / 100,
      detectedAt: new Date().toISOString(),
    };

    log.info(
      {
        title: existing.title,
        old: existing.price,
        new: incoming.price,
        pct: change.pctChange,
      },
      "Price change detected",
    );

    return { merged, change };
  }

  return { merged, change: null };
}

/**
 * Get the price trend for a product: "up" | "down" | "stable"
 */
export function getPriceTrend(
  product: Product,
): "up" | "down" | "stable" | "unknown" {
  const history = product.priceHistory;
  if (!history || history.length === 0) return "unknown";

  const lastHistoric = history.at(-1);
  if (!lastHistoric) return "unknown";

  if (product.price > lastHistoric.price) return "up";
  if (product.price < lastHistoric.price) return "down";
  return "stable";
}
