/**
 * Proxy pool — round-robin rotation of HTTP/SOCKS proxies.
 *
 * Proxies can be loaded from:
 *   1. HARVESTHUB_PROXIES env var (comma-separated)
 *   2. A text file (one proxy per line)
 *   3. Programmatically via addProxies()
 *
 * Format: http://user:pass@host:port  or  http://host:port  or  socks5://host:port
 */
import { readFile } from "node:fs/promises";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("proxy-pool");

const proxies: string[] = [];
let index = 0;

/** Load proxies from env var HARVESTHUB_PROXIES if set. */
export function loadProxiesFromEnv(): void {
  const raw = process.env["HARVESTHUB_PROXIES"];
  if (!raw) return;
  const loaded = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  addProxies(loaded);
  log.info({ count: loaded.length }, "Proxies loaded from env");
}

/** Load proxies from a text file (one proxy per line, # comments ignored). */
export async function loadProxiesFromFile(filePath: string): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const loaded = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  addProxies(loaded);
  log.info(
    { count: loaded.length, file: filePath },
    "Proxies loaded from file",
  );
}

/** Add proxies programmatically. */
export function addProxies(list: string[]): void {
  for (const p of list) {
    if (!proxies.includes(p)) proxies.push(p);
  }
}

/** Get the next proxy in round-robin order, or null if no proxies are configured. */
export function getNextProxy(): string | null {
  if (proxies.length === 0) return null;
  const proxy = proxies[index % proxies.length]!;
  index = (index + 1) % proxies.length;
  return proxy;
}

/** Get total number of configured proxies. */
export function getProxyCount(): number {
  return proxies.length;
}

/** Clear all proxies (useful for testing). */
export function clearProxies(): void {
  proxies.length = 0;
  index = 0;
}
