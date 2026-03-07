import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { Product } from "../types/index.js";
import { TransientError, PermanentError, BlockedError } from "../lib/errors.js";
import { createChildLogger } from "../lib/logger.js";
import { getNextUserAgent } from "./ua-pool.js";

const log = createChildLogger("scrape-bridge");

const ENGINE_PATH = resolve(process.cwd(), "engine", "scraper.py");

export interface ScrapeRequest {
  url: string;
  timeout?: number;
  user_agent?: string;
  use_stealth?: boolean;
}

export interface ScrapeResponse {
  success: boolean;
  product?: Partial<Product>;
  error?: string;
  error_type?: "transient" | "permanent" | "blocked";
  http_status?: number;
  elapsed_ms?: number;
  is_product_page?: boolean;
}

export async function scrapeUrl(
  url: string,
  options: { timeout?: number; useStealth?: boolean } = {},
): Promise<ScrapeResponse> {
  const timeout = options.timeout ?? 30000;
  const ua = getNextUserAgent();

  const request: ScrapeRequest = {
    url,
    timeout: Math.round(timeout / 1000),
    user_agent: ua,
    use_stealth: options.useStealth ?? false,
  };

  return new Promise((resolve, reject) => {
    const proc = spawn("python", [ENGINE_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeout + 10000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      log.error({ err, url }, "Failed to spawn Python engine");
      reject(
        new TransientError(
          `Engine spawn failed: ${err.message}`,
          "ENGINE_SPAWN_FAIL",
        ),
      );
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        log.error(
          { code, stderr: stderr.slice(0, 500), url },
          "Engine exited with error",
        );
        reject(
          new TransientError(
            `Engine exited with code ${code}: ${stderr.slice(0, 200)}`,
            "ENGINE_EXIT_ERROR",
          ),
        );
        return;
      }

      try {
        const response = JSON.parse(stdout) as ScrapeResponse;
        if (!response.success && response.error_type) {
          const msg = response.error ?? "Scrape failed";
          const status = response.http_status;
          switch (response.error_type) {
            case "permanent":
              reject(new PermanentError(msg, "SCRAPE_PERMANENT", status));
              return;
            case "blocked":
              reject(new BlockedError(msg, "SCRAPE_BLOCKED", status));
              return;
            default:
              reject(new TransientError(msg, "SCRAPE_TRANSIENT", status));
              return;
          }
        }
        resolve(response);
      } catch {
        log.error(
          { stdout: stdout.slice(0, 500), url },
          "Failed to parse engine response",
        );
        reject(
          new TransientError("Invalid JSON from engine", "ENGINE_PARSE_ERROR"),
        );
      }
    });

    proc.stdin.write(JSON.stringify(request));
    proc.stdin.end();
  });
}

export async function checkEngineHealth(): Promise<boolean> {
  try {
    const proc = spawn("python", ["-c", 'import scrapling; print("ok")'], {
      timeout: 10000,
    });
    return new Promise((resolve) => {
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  } catch {
    return false;
  }
}
