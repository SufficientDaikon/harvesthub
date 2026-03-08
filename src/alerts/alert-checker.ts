/**
 * Alert checker — checks price changes against alert thresholds.
 * Called after scraping detects a price change.
 * Only triggers on price DROPS (newPrice < oldPrice).
 */
import { nanoid } from "nanoid";
import { createChildLogger } from "../lib/logger.js";
import { loadAlerts, appendAlertHistory } from "./alert-manager.js";
import { sendWebhook } from "./webhook-sender.js";
import { sendAlertEmail } from "./email-sender.js";
import type { Product } from "../types/product.js";
import type { AlertPayload, AlertHistoryEntry } from "./types.js";

const log = createChildLogger("alert-checker");

export async function checkAlerts(
  product: Product,
  previousProduct: Product,
): Promise<void> {
  // Skip if old price is 0 (prevents division-by-zero and false positives)
  if (previousProduct.price === 0) return;
  // Only trigger on price drops
  if (product.price >= previousProduct.price) return;

  const changePercent =
    ((product.price - previousProduct.price) / previousProduct.price) * 100;
  const absChangePercent = Math.abs(changePercent);

  try {
    const alerts = await loadAlerts();

    for (const alert of alerts) {
      // Check if alert matches this product
      const matchesUrl =
        alert.productUrl && product.sourceUrl === alert.productUrl;
      const matchesDomain =
        alert.domain && product.sourceUrl.includes(alert.domain);

      if (!matchesUrl && !matchesDomain) continue;

      // Check if change exceeds threshold
      if (absChangePercent < alert.threshold) continue;

      log.info(
        {
          alertId: alert.id,
          product: product.title,
          change: changePercent.toFixed(1),
          threshold: alert.threshold,
        },
        "Alert triggered",
      );

      const payload: AlertPayload = {
        productTitle: product.title,
        productUrl: product.sourceUrl,
        oldPrice: previousProduct.price,
        newPrice: product.price,
        changePercent: Math.round(changePercent * 100) / 100,
        currency: product.currency || previousProduct.currency,
        triggeredAt: new Date().toISOString(),
      };

      let webhookOk = false;
      let emailOk = false;
      let method: "webhook" | "email" | "both" = "webhook";

      if (alert.webhookUrl && alert.email) {
        method = "both";
        webhookOk = await sendWebhook(alert.webhookUrl, payload);
        emailOk = await sendAlertEmail(alert.email, payload);
      } else if (alert.webhookUrl) {
        method = "webhook";
        webhookOk = await sendWebhook(alert.webhookUrl, payload);
      } else if (alert.email) {
        method = "email";
        emailOk = await sendAlertEmail(alert.email, payload);
      }

      let status: "sent" | "partial" | "failed";
      if (method === "both") {
        if (webhookOk && emailOk) status = "sent";
        else if (webhookOk || emailOk) status = "partial";
        else status = "failed";
      } else if (method === "webhook") {
        status = webhookOk ? "sent" : "failed";
      } else {
        status = emailOk ? "sent" : "failed";
      }

      const historyEntry: AlertHistoryEntry = {
        id: nanoid(12),
        alertId: alert.id,
        productTitle: product.title,
        productUrl: product.sourceUrl,
        oldPrice: previousProduct.price,
        newPrice: product.price,
        changePercent: Math.round(changePercent * 100) / 100,
        currency: product.currency || previousProduct.currency,
        triggeredAt: payload.triggeredAt,
        deliveryMethod: method,
        deliveryStatus: status,
      };

      await appendAlertHistory(historyEntry);
    }
  } catch (err) {
    // Alert checking failures should NOT crash the scrape pipeline
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Alert checking failed (non-fatal)",
    );
  }
}
