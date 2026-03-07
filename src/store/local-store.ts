import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import type { Product, ScrapeJob } from "../types/index.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("local-store");

const STORE_DIR = resolve(process.cwd(), "data", "store");

interface StoreData {
  products: Product[];
  jobs: ScrapeJob[];
  version: number;
}

function getPath(name: string): string {
  return resolve(STORE_DIR, `${name}.json`);
}

async function ensureDir(): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
}

async function readStore(name: string): Promise<StoreData> {
  await ensureDir();
  const path = getPath(name);
  if (!existsSync(path)) {
    return { products: [], jobs: [], version: 1 };
  }
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as StoreData;
  } catch (err) {
    log.error({ err, path }, "Corrupted store file — resetting");
    return { products: [], jobs: [], version: 1 };
  }
}

async function writeStore(name: string, data: StoreData): Promise<void> {
  await ensureDir();
  const path = getPath(name);
  const tmpPath = `${path}.tmp`;
  const json = JSON.stringify(data, null, 2);
  await writeFile(tmpPath, json, "utf-8");
  await rename(tmpPath, path);
}

export async function loadProducts(storeName = "default"): Promise<Product[]> {
  const data = await readStore(storeName);
  return data.products;
}

export async function saveProducts(
  products: Product[],
  storeName = "default",
): Promise<void> {
  const data = await readStore(storeName);
  const existingMap = new Map(data.products.map((p) => [p.id, p]));

  for (const p of products) {
    existingMap.set(p.id, p);
  }

  data.products = Array.from(existingMap.values());
  data.version++;
  await writeStore(storeName, data);
  log.info({ count: data.products.length, store: storeName }, "Products saved");
}

export async function loadJobs(storeName = "default"): Promise<ScrapeJob[]> {
  const data = await readStore(storeName);
  return data.jobs;
}

export async function saveJob(
  job: ScrapeJob,
  storeName = "default",
): Promise<void> {
  const data = await readStore(storeName);
  const idx = data.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) {
    data.jobs[idx] = job;
  } else {
    data.jobs.push(job);
  }
  data.version++;
  await writeStore(storeName, data);
}

export async function getProductCount(storeName = "default"): Promise<number> {
  const data = await readStore(storeName);
  return data.products.length;
}

export async function clearStore(storeName = "default"): Promise<void> {
  await writeStore(storeName, { products: [], jobs: [], version: 1 });
  log.info({ store: storeName }, "Store cleared");
}
