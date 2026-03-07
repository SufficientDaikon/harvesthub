export type {
  Product,
  Availability,
  ExtractionMethod,
  ConfidenceScores,
  ProductChangeRecord,
} from "./product.js";

export type {
  ScrapeJob,
  ScrapeTask,
  JobConfig,
  JobStatus,
  TaskStatus,
  TaskError,
  ErrorCategory,
} from "./job.js";

export { DEFAULT_JOB_CONFIG } from "./job.js";

export type { Schedule } from "./schedule.js";
