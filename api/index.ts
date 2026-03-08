/**
 * Vercel serverless entry point.
 *
 * Imports the Express app and exposes it as a default export for @vercel/node.
 * Sets SERVERLESS_MODE = true so scraping endpoints return 503 — the Python
 * engine is not available in Vercel's serverless runtime.
 *
 * Read-only endpoints (products, stats, exports, schedules) work normally.
 */

// Flag consumed by the Express app to gate scraping routes
process.env["SERVERLESS_MODE"] = "1";

import { createServer } from "../src/api/server.js";

const app = createServer(parseInt(process.env["PORT"] ?? "3000", 10));

// Intercept scraping endpoints and return 503 in serverless mode
app.post("/api/batch", (_req, res) => {
  res.status(503).json({
    error: "Scraping unavailable in serverless mode",
    hint: "Deploy locally or via Docker to use scraping features.",
  });
});

app.post("/api/batch/upload", (_req, res) => {
  res.status(503).json({
    error: "Scraping unavailable in serverless mode",
    hint: "Deploy locally or via Docker to use scraping features.",
  });
});

export default app;
