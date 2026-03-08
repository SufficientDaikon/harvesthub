/**
 * Tests for webhook-sender — HTTP POST to webhook URLs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AlertPayload } from "../alerts/types.js";

describe("Webhook Sender", () => {
  const mockPayload: AlertPayload = {
    productTitle: "Widget Pro",
    productUrl: "https://example.com/widget",
    oldPrice: 100,
    newPrice: 85,
    changePercent: -15,
    currency: "USD",
    triggeredAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should return true on successful 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }),
    );

    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const result = await sendWebhook("https://hooks.example.com", mockPayload);
    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://hooks.example.com",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockPayload),
      }),
    );
  });

  it("should return false on non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const result = await sendWebhook("https://hooks.example.com", mockPayload);
    expect(result).toBe(false);
  });

  it("should return false on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("DNS resolution failed")),
    );

    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const result = await sendWebhook(
      "https://unreachable.example.com",
      mockPayload,
    );
    expect(result).toBe(false);
  });
});
