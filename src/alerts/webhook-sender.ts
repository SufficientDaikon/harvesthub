/**
 * Webhook sender — POST JSON to webhook URLs.
 * WARNING: No SSRF prevention in v1. Future hardening needed.
 */
import { createChildLogger } from "../lib/logger.js";
import type { AlertPayload } from "./types.js";

const log = createChildLogger("webhook-sender");

export async function sendWebhook(
  url: string,
  payload: AlertPayload,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      log.info({ url, status: response.status }, "Webhook sent successfully");
      return true;
    }

    log.warn(
      { url, status: response.status },
      "Webhook returned non-2xx status",
    );
    return false;
  } catch (err) {
    log.warn(
      { url, err: err instanceof Error ? err.message : String(err) },
      "Webhook delivery failed",
    );
    return false;
  }
}
