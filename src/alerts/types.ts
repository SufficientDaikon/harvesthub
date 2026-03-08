/**
 * Alert types — Alert, AlertHistoryEntry, AlertPayload.
 * Used by alert-manager, alert-checker, webhook-sender, email-sender.
 */

export interface Alert {
  id: string;
  productUrl: string | null;
  domain: string | null;
  threshold: number; // percentage (1-99)
  webhookUrl: string | null;
  email: string | null;
  createdAt: string; // ISO timestamp
}

export interface AlertHistoryEntry {
  id: string;
  alertId: string;
  productTitle: string;
  productUrl: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  currency: string;
  triggeredAt: string; // ISO timestamp
  deliveryMethod: "webhook" | "email" | "both";
  deliveryStatus: "sent" | "partial" | "failed";
}

export interface AlertPayload {
  productTitle: string;
  productUrl: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  currency: string;
  triggeredAt: string;
}

export interface AlertStore {
  alerts: Alert[];
  history: AlertHistoryEntry[];
}
