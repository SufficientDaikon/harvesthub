import express from "express";
import { createServer as createHttpServer } from "node:http";
import { resolve } from "node:path";
import { WebSocketServer } from "ws";
import {
  loadProducts,
  loadJobs,
  getProductCount,
} from "../store/local-store.js";
import {
  exportProducts,
  SUPPORTED_FORMATS,
  type ExportFormat,
} from "../export/index.js";
import { checkEngineHealth } from "../core/scrape-bridge.js";
import { getUserAgentCount } from "../core/ua-pool.js";
import { createChildLogger } from "../lib/logger.js";
import { wsBroadcast } from "../core/ws-broadcast.js";
import {
  loadProxiesFromEnv,
  getProxyCount,
} from "../core/proxy-pool.js";
import {
  loadSchedules,
  saveSchedule,
  deleteSchedule,
} from "../store/local-store.js";
import {
  startAllSchedules,
  syncSchedule,
  stopScheduleJob,
  getActiveScheduleIds,
} from "../core/scheduler.js";
import type { Schedule } from "../types/schedule.js";
import { nanoid } from "nanoid";

const log = createChildLogger("api");

export function createServer(port = 3000) {
  const app = express();
  app.use(express.json());

  // Serve dashboard
  const dashboardPath = resolve(process.cwd(), "dashboard");
  app.use(express.static(dashboardPath));

  // Clean URL routes: /docs → /docs.html, /dashboard → /index.html
  app.get("/docs", (_req, res) => {
    res.sendFile(resolve(dashboardPath, "docs.html"));
  });
  app.get("/dashboard", (_req, res) => {
    res.sendFile(resolve(dashboardPath, "index.html"));
  });
  app.get("/marketing", (_req, res) => {
    res.sendFile(resolve(dashboardPath, "marketing.html"));
  });

  // Load proxies from env on startup
  loadProxiesFromEnv();

  // API: System status
  app.get("/api/status", async (_req, res) => {
    try {
      const engineOk = await checkEngineHealth();
      const productCount = await getProductCount();
      const jobs = await loadJobs();
      const lastJob = jobs.at(-1) ?? null;

      res.json({
        engine: engineOk ? "ready" : "unavailable",
        userAgents: getUserAgentCount(),
        proxies: getProxyCount(),
        productCount,
        totalJobs: jobs.length,
        lastJob: lastJob
          ? {
              id: lastJob.id,
              status: lastJob.status,
              completedUrls: lastJob.completedUrls,
              totalUrls: lastJob.totalUrls,
              completedAt: lastJob.completedAt,
            }
          : null,
        uptime: process.uptime(),
      });
    } catch (err) {
      log.error({ err }, "Status check failed");
      res.status(500).json({ error: "Status check failed" });
    }
  });

  // API: Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await loadProducts();
      const page = parseInt(req.query["page"] as string) || 1;
      const limit = Math.min(parseInt(req.query["limit"] as string) || 50, 200);
      const search = ((req.query["search"] as string) || "").toLowerCase();
      const brand = ((req.query["brand"] as string) || "").toLowerCase();
      const availability = (req.query["availability"] as string) || "";

      let filtered = products;

      if (search) {
        filtered = filtered.filter(
          (p) =>
            p.title.toLowerCase().includes(search) ||
            (p.description ?? "").toLowerCase().includes(search) ||
            (p.sku ?? "").toLowerCase().includes(search),
        );
      }
      if (brand) {
        filtered = filtered.filter((p) =>
          (p.brand ?? "").toLowerCase().includes(brand),
        );
      }
      if (availability) {
        filtered = filtered.filter((p) => p.availability === availability);
      }

      const total = filtered.length;
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);

      res.json({
        products: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      log.error({ err }, "Failed to load products");
      res.status(500).json({ error: "Failed to load products" });
    }
  });

  // API: Price history for a product
  app.get("/api/products/:id/history", async (req, res) => {
    try {
      const products = await loadProducts();
      const product = products.find((p) => p.id === req.params["id"]);
      if (!product) { res.status(404).json({ error: "Product not found" }); return; }
      res.json({
        id: product.id,
        title: product.title,
        currentPrice: product.price,
        currency: product.currency,
        priceHistory: product.priceHistory ?? [],
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load price history" });
    }
  });

  // API: Product stats
  app.get("/api/stats", async (_req, res) => {
    try {
      const products = await loadProducts();
      const brands = new Map<string, number>();
      const categories = new Map<string, number>();
      let totalPrice = 0;
      let totalConfidence = 0;
      let inStock = 0;
      let outOfStock = 0;

      for (const p of products) {
        totalPrice += p.price;
        totalConfidence += p.overallConfidence;
        if (p.availability === "in_stock") inStock++;
        if (p.availability === "out_of_stock") outOfStock++;
        if (p.brand) brands.set(p.brand, (brands.get(p.brand) ?? 0) + 1);
        if (p.category)
          categories.set(p.category, (categories.get(p.category) ?? 0) + 1);
      }

      res.json({
        totalProducts: products.length,
        inStock,
        outOfStock,
        avgPrice: products.length
          ? Math.round((totalPrice / products.length) * 100) / 100
          : 0,
        avgConfidence: products.length
          ? Math.round(totalConfidence / products.length)
          : 0,
        priceRange: {
          min: products.length ? Math.min(...products.map((p) => p.price)) : 0,
          max: products.length ? Math.max(...products.map((p) => p.price)) : 0,
        },
        topBrands: [...brands.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count })),
        topCategories: [...categories.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count })),
      });
    } catch (err) {
      log.error({ err }, "Failed to compute stats");
      res.status(500).json({ error: "Failed to compute stats" });
    }
  });

  // API: Export
  app.get("/api/export/:format", async (req, res) => {
    try {
      const format = req.params["format"] as ExportFormat;
      if (!SUPPORTED_FORMATS.includes(format)) {
        res.status(400).json({
          error: `Unsupported format. Use: ${SUPPORTED_FORMATS.join(", ")}`,
        });
        return;
      }

      const products = await loadProducts();
      if (products.length === 0) {
        res.status(404).json({ error: "No products to export" });
        return;
      }

      const ext = format === "gmc" ? "tsv" : format;
      const outputPath = resolve(
        process.cwd(),
        "data",
        "exports",
        `dashboard-export.${ext}`,
      );
      const path = await exportProducts(products, outputPath, format);

      const mimeMap: Record<string, string> = {
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        csv: "text/csv",
        json: "application/json",
        gmc: "text/tab-separated-values",
      };

      res.download(path, `harvesthub-products.${ext}`, {
        headers: {
          "Content-Type": mimeMap[format] ?? "application/octet-stream",
        },
      });
    } catch (err) {
      log.error({ err }, "Export failed");
      res.status(500).json({ error: "Export failed" });
    }
  });

  // API: Jobs history
  app.get("/api/jobs", async (_req, res) => {
    try {
      const jobs = await loadJobs();
      res.json({ jobs: jobs.slice(-20).reverse() });
    } catch (err) {
      res.status(500).json({ error: "Failed to load jobs" });
    }
  });

  // API: Schedules CRUD
  app.get("/api/schedules", async (_req, res) => {
    try {
      const schedules = await loadSchedules();
      const active = getActiveScheduleIds();
      res.json({ schedules: schedules.map((s) => ({ ...s, running: active.includes(s.id) })) });
    } catch (err) {
      res.status(500).json({ error: "Failed to load schedules" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const { name, cronExpression, urlSource, config = {}, enabled = true } = req.body as Partial<Schedule>;
      if (!name || !cronExpression || !urlSource) {
        res.status(400).json({ error: "name, cronExpression and urlSource are required" });
        return;
      }
      const schedule: Schedule = {
        id: nanoid(12),
        name,
        cronExpression,
        urlSource,
        config: {
          maxRetries: 3,
          retryBaseDelay: 2000,
          retryMultiplier: 2,
          rateLimit: 1,
          concurrentDomains: 3,
          proxyEnabled: false,
          timeout: 30_000,
          ...config,
        },
        enabled: enabled !== false,
        lastRunAt: null,
        lastRunStatus: null,
        createdAt: new Date().toISOString(),
      };
      await saveSchedule(schedule);
      await syncSchedule(schedule);
      res.status(201).json({ schedule });
    } catch (err) {
      log.error({ err }, "Failed to create schedule");
      res.status(500).json({ error: "Failed to create schedule" });
    }
  });

  app.patch("/api/schedules/:id", async (req, res) => {
    try {
      const schedules = await loadSchedules();
      const schedule = schedules.find((s) => s.id === req.params["id"]);
      if (!schedule) { res.status(404).json({ error: "Schedule not found" }); return; }
      const updated: Schedule = { ...schedule, ...req.body, id: schedule.id };
      await saveSchedule(updated);
      await syncSchedule(updated);
      res.json({ schedule: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update schedule" });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    try {
      stopScheduleJob(req.params["id"]!);
      const deleted = await deleteSchedule(req.params["id"]!);
      if (!deleted) { res.status(404).json({ error: "Schedule not found" }); return; }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  const httpServer = createHttpServer(app);

  // WebSocket server on same port (upgrade path: /ws)
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws) => {
    wsBroadcast.register(ws);
    log.debug("WebSocket client connected");
  });

  httpServer.listen(port, () => {
    log.info(
      { port },
      `HarvestHub Dashboard running at http://localhost:${port}`,
    );
    console.log(`\n  🌾 HarvestHub Dashboard: http://localhost:${port}`);
    console.log(`  🔌 WebSocket: ws://localhost:${port}/ws\n`);
    // Start all persisted schedules
    startAllSchedules().catch((err) => log.error({ err }, "Failed to start schedules"));
  });

  return app;
}
