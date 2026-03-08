import express from "express";
import { createServer as createHttpServer } from "node:http";
import { resolve } from "node:path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
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

  // Swagger/OpenAPI setup
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "HarvestHub API",
        version: "1.0.0",
        description:
          "Adaptive product scraping platform API — extract, search, filter, export and schedule product data from any e-commerce site.",
      },
      servers: [{ url: "/", description: "Current server" }],
    },
    apis: ["./src/api/server.ts", "./dist/api/server.js"],
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
  app.get("/docs-ar", (_req, res) => {
    res.sendFile(resolve(dashboardPath, "docs-ar.html"));
  });
  app.get("/dashboard-ar", (_req, res) => {
    res.sendFile(resolve(dashboardPath, "index-ar.html"));
  });
  app.get("/marketing-ar", (_req, res) => {
    res.sendFile(resolve(dashboardPath, "marketing-ar.html"));
  });

  // Load proxies from env on startup
  loadProxiesFromEnv();

  /**
   * @openapi
   * components:
   *   schemas:
   *     ErrorResponse:
   *       type: object
   *       properties:
   *         error:
   *           type: string
   *       example:
   *         error: "Something went wrong"
   *     Product:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *         sourceUrl:
   *           type: string
   *           format: uri
   *         scrapedAt:
   *           type: string
   *           format: date-time
   *         title:
   *           type: string
   *         price:
   *           type: number
   *         currency:
   *           type: string
   *         description:
   *           type: string
   *           nullable: true
   *         images:
   *           type: array
   *           items:
   *             type: string
   *         availability:
   *           type: string
   *           enum: [in_stock, out_of_stock, pre_order, unknown]
   *         brand:
   *           type: string
   *           nullable: true
   *         sku:
   *           type: string
   *           nullable: true
   *         mpn:
   *           type: string
   *           nullable: true
   *         gtin:
   *           type: string
   *           nullable: true
   *         category:
   *           type: string
   *           nullable: true
   *         rating:
   *           type: number
   *           nullable: true
   *         reviewCount:
   *           type: integer
   *           nullable: true
   *         specifications:
   *           type: object
   *           additionalProperties:
   *             type: string
   *         seller:
   *           type: string
   *           nullable: true
   *         shipping:
   *           type: string
   *           nullable: true
   *         alternativePrices:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               price:
   *                 type: number
   *               currency:
   *                 type: string
   *         confidenceScores:
   *           type: object
   *           additionalProperties:
   *             type: number
   *         overallConfidence:
   *           type: number
   *           minimum: 0
   *           maximum: 100
   *         extractionMethod:
   *           type: string
   *           enum: [adaptive, template, ai_fallback]
   *         metadata:
   *           type: object
   *         priceHistory:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/PriceHistoryEntry'
   *     PriceHistoryEntry:
   *       type: object
   *       properties:
   *         price:
   *           type: number
   *         currency:
   *           type: string
   *         recordedAt:
   *           type: string
   *           format: date-time
   *     Schedule:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *         name:
   *           type: string
   *         cronExpression:
   *           type: string
   *         urlSource:
   *           type: string
   *         config:
   *           $ref: '#/components/schemas/JobConfig'
   *         enabled:
   *           type: boolean
   *         lastRunAt:
   *           type: string
   *           nullable: true
   *         lastRunStatus:
   *           type: string
   *           nullable: true
   *           enum: [queued, running, completed, failed, paused]
   *         createdAt:
   *           type: string
   *           format: date-time
   *         running:
   *           type: boolean
   *     JobConfig:
   *       type: object
   *       properties:
   *         maxRetries:
   *           type: integer
   *         retryBaseDelay:
   *           type: integer
   *         retryMultiplier:
   *           type: number
   *         rateLimit:
   *           type: number
   *         concurrentDomains:
   *           type: integer
   *         proxyEnabled:
   *           type: boolean
   *         timeout:
   *           type: integer
   *     ScrapeJob:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *         status:
   *           type: string
   *           enum: [queued, running, completed, failed, paused]
   *         createdAt:
   *           type: string
   *           format: date-time
   *         startedAt:
   *           type: string
   *           nullable: true
   *         completedAt:
   *           type: string
   *           nullable: true
   *         totalUrls:
   *           type: integer
   *         completedUrls:
   *           type: integer
   *         failedUrls:
   *           type: integer
   *         config:
   *           $ref: '#/components/schemas/JobConfig'
   *     StatsResponse:
   *       type: object
   *       properties:
   *         totalProducts:
   *           type: integer
   *         inStock:
   *           type: integer
   *         outOfStock:
   *           type: integer
   *         avgPrice:
   *           type: number
   *         avgConfidence:
   *           type: number
   *         priceRange:
   *           type: object
   *           properties:
   *             min:
   *               type: number
   *             max:
   *               type: number
   *         topBrands:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               count:
   *                 type: integer
   *         topCategories:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               count:
   *                 type: integer
   */

  /**
   * @openapi
   * /api/status:
   *   get:
   *     summary: System status
   *     description: Returns engine health, product count, job history, and uptime
   *     tags: [System]
   *     responses:
   *       200:
   *         description: System status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 engine:
   *                   type: string
   *                   enum: [ready, unavailable]
   *                   example: ready
   *                 userAgents:
   *                   type: integer
   *                   example: 20
   *                 proxies:
   *                   type: integer
   *                   example: 0
   *                 productCount:
   *                   type: integer
   *                   example: 42
   *                 totalJobs:
   *                   type: integer
   *                   example: 5
   *                 lastJob:
   *                   type: object
   *                   nullable: true
   *                   properties:
   *                     id:
   *                       type: string
   *                     status:
   *                       type: string
   *                     completedUrls:
   *                       type: integer
   *                     totalUrls:
   *                       type: integer
   *                     completedAt:
   *                       type: string
   *                       nullable: true
   *                   example: null
   *                 uptime:
   *                   type: number
   *                   example: 3600.5
   *       500:
   *         description: Status check failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @openapi
   * /api/products:
   *   get:
   *     summary: Get all products
   *     description: Returns a paginated, filterable list of scraped products
   *     tags: [Products]
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search in title, description, and SKU
   *       - in: query
   *         name: domain
   *         schema:
   *           type: string
   *         description: Filter by source domain
   *       - in: query
   *         name: brand
   *         schema:
   *           type: string
   *         description: Filter by brand name
   *       - in: query
   *         name: availability
   *         schema:
   *           type: string
   *           enum: [in_stock, out_of_stock, pre_order, unknown]
   *         description: Filter by availability status
   *       - in: query
   *         name: minPrice
   *         schema:
   *           type: number
   *         description: Minimum price filter
   *       - in: query
   *         name: maxPrice
   *         schema:
   *           type: number
   *         description: Maximum price filter
   *       - in: query
   *         name: minConfidence
   *         schema:
   *           type: number
   *         description: Minimum confidence score filter
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *           maximum: 200
   *         description: Items per page (max 200)
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *         description: Field to sort by
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *         description: Sort order
   *     responses:
   *       200:
   *         description: Paginated product list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 products:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Product'
   *                 total:
   *                   type: integer
   *                   example: 42
   *                 page:
   *                   type: integer
   *                   example: 1
   *                 limit:
   *                   type: integer
   *                   example: 50
   *                 totalPages:
   *                   type: integer
   *                   example: 1
   *       500:
   *         description: Failed to load products
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @openapi
   * /api/products/{id}/history:
   *   get:
   *     summary: Price history for a product
   *     description: Returns the price history for a specific product
   *     tags: [Products]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Product ID
   *     responses:
   *       200:
   *         description: Product price history
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "abc123"
   *                 title:
   *                   type: string
   *                   example: "Wireless Headphones"
   *                 currentPrice:
   *                   type: number
   *                   example: 59.99
   *                 currency:
   *                   type: string
   *                   example: "USD"
   *                 priceHistory:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PriceHistoryEntry'
   *       404:
   *         description: Product not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: "Product not found"
   *       500:
   *         description: Failed to load price history
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @openapi
   * /api/stats:
   *   get:
   *     summary: Product statistics
   *     description: Returns aggregate statistics about all scraped products
   *     tags: [Statistics]
   *     responses:
   *       200:
   *         description: Product statistics
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StatsResponse'
   *             example:
   *               totalProducts: 42
   *               inStock: 35
   *               outOfStock: 7
   *               avgPrice: 49.99
   *               avgConfidence: 85
   *               priceRange:
   *                 min: 5.99
   *                 max: 299.99
   *               topBrands:
   *                 - name: "Nike"
   *                   count: 10
   *               topCategories:
   *                 - name: "Electronics"
   *                   count: 15
   *       500:
   *         description: Failed to compute stats
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @openapi
   * /api/export/{format}:
   *   get:
   *     summary: Export products
   *     description: Export all products in the specified format as a file download
   *     tags: [Export]
   *     parameters:
   *       - in: path
   *         name: format
   *         required: true
   *         schema:
   *           type: string
   *           enum: [xlsx, csv, json, gmc]
   *         description: Export format
   *     responses:
   *       200:
   *         description: File download
   *         content:
   *           application/octet-stream:
   *             schema:
   *               type: string
   *               format: binary
   *       400:
   *         description: Unsupported format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: "Unsupported format. Use: xlsx, csv, json, gmc"
   *       404:
   *         description: No products to export
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: "No products to export"
   *       500:
   *         description: Export failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @openapi
   * /api/jobs:
   *   get:
   *     summary: Jobs history
   *     description: Returns the last 20 scrape jobs in reverse chronological order
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job history
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 jobs:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ScrapeJob'
   *             example:
   *               jobs: []
   *       500:
   *         description: Failed to load jobs
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // API: Jobs history
  app.get("/api/jobs", async (_req, res) => {
    try {
      const jobs = await loadJobs();
      res.json({ jobs: jobs.slice(-20).reverse() });
    } catch (err) {
      res.status(500).json({ error: "Failed to load jobs" });
    }
  });

  /**
   * @openapi
   * /api/schedules:
   *   get:
   *     summary: List schedules
   *     description: Returns all configured scrape schedules with their running status
   *     tags: [Schedules]
   *     responses:
   *       200:
   *         description: Schedule list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 schedules:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Schedule'
   *             example:
   *               schedules: []
   *       500:
   *         description: Failed to load schedules
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @openapi
   * /api/schedules:
   *   post:
   *     summary: Create a schedule
   *     description: Create a new scrape schedule with a cron expression
   *     tags: [Schedules]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, cronExpression, urlSource]
   *             properties:
   *               name:
   *                 type: string
   *                 example: "Daily Amazon scrape"
   *               cronExpression:
   *                 type: string
   *                 example: "0 9 * * *"
   *               urlSource:
   *                 type: string
   *                 example: "https://amazon.com/product/123"
   *               config:
   *                 $ref: '#/components/schemas/JobConfig'
   *               enabled:
   *                 type: boolean
   *                 default: true
   *     responses:
   *       201:
   *         description: Schedule created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 schedule:
   *                   $ref: '#/components/schemas/Schedule'
   *       400:
   *         description: Missing required fields
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: "name, cronExpression and urlSource are required"
   *       500:
   *         description: Failed to create schedule
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @openapi
   * /api/schedules/{id}:
   *   patch:
   *     summary: Update a schedule
   *     description: Update fields of an existing schedule
   *     tags: [Schedules]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Schedule ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               cronExpression:
   *                 type: string
   *               urlSource:
   *                 type: string
   *               config:
   *                 $ref: '#/components/schemas/JobConfig'
   *               enabled:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Schedule updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 schedule:
   *                   $ref: '#/components/schemas/Schedule'
   *       404:
   *         description: Schedule not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: "Schedule not found"
   *       500:
   *         description: Failed to update schedule
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @openapi
   * /api/schedules/{id}:
   *   delete:
   *     summary: Delete a schedule
   *     description: Stop and delete a schedule by ID
   *     tags: [Schedules]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Schedule ID
   *     responses:
   *       200:
   *         description: Schedule deleted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok:
   *                   type: boolean
   *                   example: true
   *       404:
   *         description: Schedule not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             example:
   *               error: "Schedule not found"
   *       500:
   *         description: Failed to delete schedule
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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
