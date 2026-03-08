/**
 * Tests for alert-manager — CRUD for alerts and alert history.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolve } from "node:path";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

// We need to mock the store directory to avoid polluting real data
const TEST_DIR = resolve(process.cwd(), "data", "store", "__test_alerts__");
const ALERTS_FILE = resolve(TEST_DIR, "alerts.json");

// Mock the module to use our test directory
vi.mock("../alerts/alert-manager.ts", async () => {
  // We'll test the functions directly with our own store file approach
  const actual = await vi.importActual("../alerts/alert-manager.ts");
  return actual;
});

describe("Alert Manager", () => {
  // Since alert-manager uses a hardcoded path, we test the core logic
  // by importing the module and using real file operations

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should handle empty alerts store gracefully", async () => {
    // The alert-manager uses data/store/alerts.json
    // We test the functions through the actual module
    const { loadAlerts, loadAlertHistory } = await import(
      "../alerts/alert-manager.js"
    );

    // On first load, there should be empty arrays
    const alerts = await loadAlerts();
    expect(Array.isArray(alerts)).toBe(true);

    const history = await loadAlertHistory();
    expect(Array.isArray(history)).toBe(true);
  });

  it("should save and load an alert", async () => {
    const { loadAlerts, saveAlert, deleteAlert } = await import(
      "../alerts/alert-manager.js"
    );

    const alert = {
      id: "test-alert-1",
      productUrl: "https://example.com/product",
      domain: null,
      threshold: 10,
      webhookUrl: "https://hooks.example.com/notify",
      email: null,
      createdAt: new Date().toISOString(),
    };

    await saveAlert(alert);

    const alerts = await loadAlerts();
    const found = alerts.find((a) => a.id === "test-alert-1");
    expect(found).toBeDefined();
    expect(found?.productUrl).toBe("https://example.com/product");
    expect(found?.threshold).toBe(10);
    expect(found?.webhookUrl).toBe("https://hooks.example.com/notify");

    // Cleanup
    await deleteAlert("test-alert-1");
  });

  it("should delete an alert", async () => {
    const { loadAlerts, saveAlert, deleteAlert } = await import(
      "../alerts/alert-manager.js"
    );

    const alert = {
      id: "test-alert-delete",
      productUrl: "https://example.com/item",
      domain: null,
      threshold: 15,
      webhookUrl: null,
      email: "user@example.com",
      createdAt: new Date().toISOString(),
    };

    await saveAlert(alert);
    const deleted = await deleteAlert("test-alert-delete");
    expect(deleted).toBe(true);

    const alerts = await loadAlerts();
    expect(alerts.find((a) => a.id === "test-alert-delete")).toBeUndefined();
  });

  it("should return false when deleting non-existent alert", async () => {
    const { deleteAlert } = await import("../alerts/alert-manager.js");
    const deleted = await deleteAlert("non-existent-id");
    expect(deleted).toBe(false);
  });

  it("should append and load alert history", async () => {
    const { appendAlertHistory, loadAlertHistory } = await import(
      "../alerts/alert-manager.js"
    );

    const entry = {
      id: "test-history-1",
      alertId: "alert-1",
      productTitle: "Test Product",
      productUrl: "https://example.com/product",
      oldPrice: 100,
      newPrice: 85,
      changePercent: -15,
      currency: "USD",
      triggeredAt: new Date().toISOString(),
      deliveryMethod: "webhook" as const,
      deliveryStatus: "sent" as const,
    };

    await appendAlertHistory(entry);

    const history = await loadAlertHistory();
    const found = history.find((h) => h.id === "test-history-1");
    expect(found).toBeDefined();
    expect(found?.productTitle).toBe("Test Product");
    expect(found?.changePercent).toBe(-15);
  });
});
