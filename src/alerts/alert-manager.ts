/**
 * Alert CRUD + history persistence to data/store/alerts.json.
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createChildLogger } from "../lib/logger.js";
import type { Alert, AlertHistoryEntry, AlertStore } from "./types.js";

const log = createChildLogger("alert-manager");

const STORE_DIR = resolve(process.cwd(), "data", "store");
const ALERTS_FILE = resolve(STORE_DIR, "alerts.json");

async function ensureDir(): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
}

async function readAlertStore(): Promise<AlertStore> {
  await ensureDir();
  if (!existsSync(ALERTS_FILE)) {
    return { alerts: [], history: [] };
  }
  try {
    const raw = await readFile(ALERTS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as AlertStore;
    if (!parsed.alerts) parsed.alerts = [];
    if (!parsed.history) parsed.history = [];
    return parsed;
  } catch (err) {
    log.error({ err }, "Corrupted alerts file — resetting");
    return { alerts: [], history: [] };
  }
}

async function writeAlertStore(data: AlertStore): Promise<void> {
  await ensureDir();
  const tmpPath = `${ALERTS_FILE}.tmp`;
  const json = JSON.stringify(data, null, 2);
  await writeFile(tmpPath, json, "utf-8");
  await rename(tmpPath, ALERTS_FILE);
}

export async function loadAlerts(): Promise<Alert[]> {
  const store = await readAlertStore();
  return store.alerts;
}

export async function saveAlert(alert: Alert): Promise<void> {
  const store = await readAlertStore();
  const idx = store.alerts.findIndex((a) => a.id === alert.id);
  if (idx >= 0) {
    store.alerts[idx] = alert;
  } else {
    store.alerts.push(alert);
  }
  await writeAlertStore(store);
  log.info({ alertId: alert.id }, "Alert saved");
}

export async function deleteAlert(id: string): Promise<boolean> {
  const store = await readAlertStore();
  const before = store.alerts.length;
  store.alerts = store.alerts.filter((a) => a.id !== id);
  if (store.alerts.length === before) return false;
  await writeAlertStore(store);
  log.info({ alertId: id }, "Alert deleted");
  return true;
}

export async function loadAlertHistory(): Promise<AlertHistoryEntry[]> {
  const store = await readAlertStore();
  return store.history
    .sort(
      (a, b) =>
        new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
    )
    .slice(0, 100);
}

export async function appendAlertHistory(
  entry: AlertHistoryEntry,
): Promise<void> {
  const store = await readAlertStore();
  store.history.push(entry);
  // Keep max 500 history entries
  if (store.history.length > 500) {
    store.history = store.history
      .sort(
        (a, b) =>
          new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
      )
      .slice(0, 500);
  }
  await writeAlertStore(store);
  log.info({ entryId: entry.id }, "Alert history entry appended");
}
