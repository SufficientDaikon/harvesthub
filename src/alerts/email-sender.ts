/**
 * Email sender — SMTP email sending via nodemailer.
 * SMTP config from env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * If SMTP env vars are not set, logs a warning and returns false without throwing.
 */
import { createTransport } from "nodemailer";
import { createChildLogger } from "../lib/logger.js";
import type { AlertPayload } from "./types.js";

const log = createChildLogger("email-sender");

function getSmtpConfig() {
  const host = process.env["SMTP_HOST"];
  const port = parseInt(process.env["SMTP_PORT"] || "587", 10);
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const from = process.env["SMTP_FROM"] || "alerts@harvesthub.local";

  return { host, port, user, pass, from };
}

export async function sendAlertEmail(
  to: string,
  payload: AlertPayload,
): Promise<boolean> {
  const smtp = getSmtpConfig();

  if (!smtp.host || !smtp.user || !smtp.pass) {
    log.warn(
      "SMTP not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS). Skipping email.",
    );
    return false;
  }

  try {
    const transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    const sign = payload.changePercent > 0 ? "+" : "";
    const subject = `🔔 HarvestHub Alert: Price dropped for ${payload.productTitle}`;
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#e94560">🔔 Price Drop Alert</h2>
        <p><strong>${payload.productTitle}</strong></p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px;border:1px solid #ddd"><strong>Old Price</strong></td>
            <td style="padding:8px;border:1px solid #ddd">${payload.currency} ${payload.oldPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #ddd"><strong>New Price</strong></td>
            <td style="padding:8px;border:1px solid #ddd;color:#00a86b;font-weight:bold">${payload.currency} ${payload.newPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #ddd"><strong>Change</strong></td>
            <td style="padding:8px;border:1px solid #ddd">${sign}${payload.changePercent.toFixed(1)}%</td>
          </tr>
        </table>
        <p><a href="${payload.productUrl}" style="color:#e94560">View Product →</a></p>
        <p style="color:#888;font-size:12px">Triggered at ${payload.triggeredAt}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#888;font-size:11px">Sent by HarvestHub Alert System</p>
      </div>
    `;

    await transporter.sendMail({
      from: smtp.from,
      to,
      subject,
      html,
    });

    log.info({ to }, "Alert email sent successfully");
    return true;
  } catch (err) {
    log.warn(
      { to, err: err instanceof Error ? err.message : String(err) },
      "Email delivery failed",
    );
    return false;
  }
}
