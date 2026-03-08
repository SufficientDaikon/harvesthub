/**
 * Tests for alert-checker — price-drop detection and alert matching.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Product } from "../types/product.js";

// Mock dependencies to isolate alert-checker logic
vi.mock("../alerts/alert-manager.js", () => ({
  loadAlerts: vi.fn(),
  appendAlertHistory: vi.fn(),
}));

vi.mock("../alerts/webhook-sender.js", () => ({
  sendWebhook: vi.fn(),
}));

vi.mock("../alerts/email-sender.js", () => ({
  sendAlertEmail: vi.fn(),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    sourceUrl: "https://example.com/widget",
    scrapedAt: new Date().toISOString(),
    title: "Widget Pro",
    price: 100,
    currency: "USD",
    description: null,
    images: [],
    availability: "in_stock",
    brand: null,
    sku: null,
    mpn: null,
    gtin: null,
    category: null,
    rating: null,
    reviewCount: null,
    specifications: {},
    seller: null,
    shipping: null,
    alternativePrices: [],
    confidenceScores: {},
    overallConfidence: 85,
    extractionMethod: "adaptive",
    metadata: {},
    ...overrides,
  };
}

describe("Alert Checker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not trigger alerts when price increases", async () => {
    const { loadAlerts } = await import("../alerts/alert-manager.js");
    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const { checkAlerts } = await import("../alerts/alert-checker.js");

    vi.mocked(loadAlerts).mockResolvedValue([
      {
        id: "alert-1",
        productUrl: "https://example.com/widget",
        domain: null,
        threshold: 10,
        webhookUrl: "https://hooks.example.com",
        email: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    const previous = makeProduct({ price: 100 });
    const current = makeProduct({ price: 110 }); // price went UP

    await checkAlerts(current, previous);

    expect(sendWebhook).not.toHaveBeenCalled();
  });

  it("should not trigger alerts when change is below threshold", async () => {
    const { loadAlerts } = await import("../alerts/alert-manager.js");
    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const { checkAlerts } = await import("../alerts/alert-checker.js");

    vi.mocked(loadAlerts).mockResolvedValue([
      {
        id: "alert-1",
        productUrl: "https://example.com/widget",
        domain: null,
        threshold: 10,
        webhookUrl: "https://hooks.example.com",
        email: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    const previous = makeProduct({ price: 100 });
    const current = makeProduct({ price: 95 }); // only 5% drop, threshold is 10%

    await checkAlerts(current, previous);

    expect(sendWebhook).not.toHaveBeenCalled();
  });

  it("should trigger webhook when price drops beyond threshold", async () => {
    const { loadAlerts, appendAlertHistory } = await import(
      "../alerts/alert-manager.js"
    );
    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const { checkAlerts } = await import("../alerts/alert-checker.js");

    vi.mocked(loadAlerts).mockResolvedValue([
      {
        id: "alert-1",
        productUrl: "https://example.com/widget",
        domain: null,
        threshold: 10,
        webhookUrl: "https://hooks.example.com/notify",
        email: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(sendWebhook).mockResolvedValue(true);
    vi.mocked(appendAlertHistory).mockResolvedValue(undefined);

    const previous = makeProduct({ price: 100 });
    const current = makeProduct({ price: 85 }); // 15% drop

    await checkAlerts(current, previous);

    expect(sendWebhook).toHaveBeenCalledWith(
      "https://hooks.example.com/notify",
      expect.objectContaining({
        productTitle: "Widget Pro",
        productUrl: "https://example.com/widget",
        oldPrice: 100,
        newPrice: 85,
        currency: "USD",
      }),
    );
    expect(appendAlertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: "alert-1",
        deliveryMethod: "webhook",
        deliveryStatus: "sent",
      }),
    );
  });

  it("should match domain-based alerts", async () => {
    const { loadAlerts, appendAlertHistory } = await import(
      "../alerts/alert-manager.js"
    );
    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const { checkAlerts } = await import("../alerts/alert-checker.js");

    vi.mocked(loadAlerts).mockResolvedValue([
      {
        id: "alert-domain",
        productUrl: null,
        domain: "example.com",
        threshold: 5,
        webhookUrl: "https://hooks.slack.com/trigger",
        email: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(sendWebhook).mockResolvedValue(true);
    vi.mocked(appendAlertHistory).mockResolvedValue(undefined);

    const previous = makeProduct({
      sourceUrl: "https://example.com/other-product",
      price: 200,
    });
    const current = makeProduct({
      sourceUrl: "https://example.com/other-product",
      price: 170,
    }); // 15% drop

    await checkAlerts(current, previous);

    expect(sendWebhook).toHaveBeenCalled();
  });

  it("should skip alert checking when old price is 0", async () => {
    const { loadAlerts } = await import("../alerts/alert-manager.js");
    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const { checkAlerts } = await import("../alerts/alert-checker.js");

    const previous = makeProduct({ price: 0 });
    const current = makeProduct({ price: 50 });

    await checkAlerts(current, previous);

    expect(loadAlerts).not.toHaveBeenCalled();
    expect(sendWebhook).not.toHaveBeenCalled();
  });

  it("should record failed delivery in history", async () => {
    const { loadAlerts, appendAlertHistory } = await import(
      "../alerts/alert-manager.js"
    );
    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const { checkAlerts } = await import("../alerts/alert-checker.js");

    vi.mocked(loadAlerts).mockResolvedValue([
      {
        id: "alert-fail",
        productUrl: "https://example.com/widget",
        domain: null,
        threshold: 5,
        webhookUrl: "https://unreachable.example.com",
        email: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(sendWebhook).mockResolvedValue(false); // webhook fails
    vi.mocked(appendAlertHistory).mockResolvedValue(undefined);

    const previous = makeProduct({ price: 100 });
    const current = makeProduct({ price: 80 }); // 20% drop

    await checkAlerts(current, previous);

    expect(appendAlertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryStatus: "failed",
      }),
    );
  });

  it("should handle both webhook and email delivery", async () => {
    const { loadAlerts, appendAlertHistory } = await import(
      "../alerts/alert-manager.js"
    );
    const { sendWebhook } = await import("../alerts/webhook-sender.js");
    const { sendAlertEmail } = await import("../alerts/email-sender.js");
    const { checkAlerts } = await import("../alerts/alert-checker.js");

    vi.mocked(loadAlerts).mockResolvedValue([
      {
        id: "alert-both",
        productUrl: "https://example.com/widget",
        domain: null,
        threshold: 10,
        webhookUrl: "https://hooks.example.com",
        email: "user@example.com",
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(sendWebhook).mockResolvedValue(true);
    vi.mocked(sendAlertEmail).mockResolvedValue(false); // email fails

    vi.mocked(appendAlertHistory).mockResolvedValue(undefined);

    const previous = makeProduct({ price: 100 });
    const current = makeProduct({ price: 85 }); // 15% drop

    await checkAlerts(current, previous);

    expect(sendWebhook).toHaveBeenCalled();
    expect(sendAlertEmail).toHaveBeenCalled();
    expect(appendAlertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryMethod: "both",
        deliveryStatus: "partial", // webhook ok, email failed
      }),
    );
  });
});
