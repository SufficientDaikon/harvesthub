/**
 * HarvestHub — Public API
 *
 * This module is the main entry point when consuming HarvestHub as a library.
 *
 * @example
 * ```ts
 * import { createServer } from 'harvest-hub';
 * const app = createServer(4000);
 * ```
 */
export { createServer } from "./api/server.js";

export {
  loadProducts,
  saveProducts,
  loadJobs,
  saveJob,
  getProductCount,
  clearStore,
  loadSchedules,
  saveSchedule,
  deleteSchedule,
} from "./store/local-store.js";

export type {
  Product,
  Availability,
  ExtractionMethod,
  ConfidenceScores,
  ProductChangeRecord,
} from "./types/product.js";

export type {
  ScrapeJob,
  ScrapeTask,
  JobConfig,
  JobStatus,
  TaskStatus,
  TaskError,
  ErrorCategory,
} from "./types/job.js";

export type { Schedule } from "./types/schedule.js";

export {
  exportProducts,
  SUPPORTED_FORMATS,
  exportXlsx,
  exportCsv,
  exportJson,
  exportGmc,
} from "./export/index.js";

export type { ExportFormat } from "./export/index.js";
