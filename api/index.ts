/**
 * Vercel serverless entry point.
 * The Express app handles all routes including serving the dashboard static files.
 *
 * NOTE: The Python scraping engine is not available on Vercel — the dashboard
 * runs in read-only mode (showing pre-deployed product data). Schedule cron
 * jobs and live scraping require a local or server deployment.
 */
import { createServer } from "../src/api/server.js";

const app = createServer(parseInt(process.env["PORT"] ?? "3000", 10));

export default app;
