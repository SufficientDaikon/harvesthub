import type { ErrorCategory } from "../types/index.js";

export class HarvestError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly code: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "HarvestError";
  }
}

export class TransientError extends HarvestError {
  constructor(message: string, code: string, httpStatus?: number) {
    super(message, "transient", code, httpStatus);
    this.name = "TransientError";
  }
}

export class PermanentError extends HarvestError {
  constructor(message: string, code: string, httpStatus?: number) {
    super(message, "permanent", code, httpStatus);
    this.name = "PermanentError";
  }
}

export class BlockedError extends HarvestError {
  constructor(message: string, code: string, httpStatus?: number) {
    super(message, "blocked", code, httpStatus);
    this.name = "BlockedError";
  }
}

export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof HarvestError) return error.category;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("404") || msg.includes("not found")) return "permanent";
    if (msg.includes("410") || msg.includes("gone")) return "permanent";
    if (msg.includes("ssl") || msg.includes("certificate")) return "permanent";
    if (msg.includes("invalid url")) return "permanent";
    if (msg.includes("403") || msg.includes("forbidden")) return "blocked";
    if (msg.includes("captcha")) return "blocked";
    if (msg.includes("429") || msg.includes("too many")) return "blocked";
    if (msg.includes("cloudflare")) return "blocked";
    return "transient";
  }

  return "transient";
}

export function classifyHttpStatus(status: number): ErrorCategory {
  if (status === 404 || status === 410 || status === 451) return "permanent";
  if (status === 403 || status === 429) return "blocked";
  if (status >= 500) return "transient";
  if (status === 408 || status === 504) return "transient";
  return "transient";
}
