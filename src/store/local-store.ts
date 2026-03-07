import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import type { Product, ScrapeJob } from "../types/index.js";
import type { Schedule } from "../types/schedule.js";
import { diffAndMerge } from "../core/price-differ.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("local-store");

const STORE_DIR = resolve(process.cwd(), "data", "store");

interface StoreData {
  products: Product[];
  jobs: ScrapeJob[];
  schedules: Schedule[];
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
    return { products: [], jobs: [], schedules: [], version: 1 };
  }
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as StoreData;
    // Back-compat: older stores may not have schedules
    if (!parsed.schedules) parsed.schedules = [];
    return parsed;
  } catch (err) {
    log.error({ err, path }, "Corrupted store file — resetting");
    return { products: [], jobs: [], schedules: [], version: 1 };
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
    const existing = existingMap.get(p.id);
    if (existing) {
      const { merged } = diffAndMerge(existing, p);
      existingMap.set(p.id, merged);
    } else {
      existingMap.set(p.id, p);
    }
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
  await writeStore(storeName, { products: [], jobs: [], schedules: [], version: 1 });
  log.info({ store: storeName }, "Store cleared");
}

export async function loadSchedules(storeName = "default"): Promise<Schedule[]> {
  const data = await readStore(storeName);
  return data.schedules;
}

export async function saveSchedule(
  schedule: Schedule,
  storeName = "default",
): Promise<void> {
  const data = await readStore(storeName);
  const idx = data.schedules.findIndex((s) => s.id === schedule.id);
  if (idx >= 0) {
    data.schedules[idx] = schedule;
  } else {
    data.schedules.push(schedule);
  }
  data.version++;
  await writeStore(storeName, data);
}

export async function deleteSchedule(
  scheduleId: string,
  storeName = "default",
): Promise<boolean> {
  const data = await readStore(storeName);
  const before = data.schedules.length;
  data.schedules = data.schedules.filter((s) => s.id !== scheduleId);
  if (data.schedules.length === before) return false;
  data.version++;
  await writeStore(storeName, data);
  return true;
}
