/**
 * Tests for email-sender — SMTP email delivery via nodemailer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AlertPayload } from "../alerts/types.js";

const mockSendMail = vi.fn();

vi.mock("nodemailer", () => ({
  createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
}));

describe("Email Sender", () => {
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
    vi.unstubAllEnvs();
  });

  it("sends email when SMTP is configured", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "user@example.com");
    vi.stubEnv("SMTP_PASS", "secret");
    vi.stubEnv("SMTP_FROM", "alerts@example.com");
    mockSendMail.mockResolvedValue({ messageId: "abc123" });

    const { sendAlertEmail } = await import("../alerts/email-sender.js");
    const result = await sendAlertEmail("recipient@example.com", mockPayload);

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledOnce();
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "recipient@example.com",
        from: "alerts@example.com",
      }),
    );
  });

  it("skips gracefully when SMTP is not configured", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");

    const { sendAlertEmail } = await import("../alerts/email-sender.js");
    const result = await sendAlertEmail("recipient@example.com", mockPayload);

    expect(result).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("handles SMTP errors without crashing", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "user@example.com");
    vi.stubEnv("SMTP_PASS", "secret");
    mockSendMail.mockRejectedValue(new Error("Connection refused"));

    const { sendAlertEmail } = await import("../alerts/email-sender.js");
    const result = await sendAlertEmail("recipient@example.com", mockPayload);

    expect(result).toBe(false);
  });
});
