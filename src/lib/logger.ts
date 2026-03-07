import pino from "pino";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const LOG_DIR = resolve(process.cwd(), "data", "logs");

try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch {
  /* ignore */
}

const transport = process.stdout.isTTY
  ? { target: "pino-pretty", options: { colorize: true } }
  : undefined;

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  transport,
});

export function createChildLogger(module: string) {
  return logger.child({ module });
}
