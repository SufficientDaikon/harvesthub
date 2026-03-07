export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "paused";

export type TaskStatus =
  | "pending"
  | "scraping"
  | "success"
  | "failed"
  | "skipped";

export type ErrorCategory = "transient" | "permanent" | "blocked";

export interface TaskError {
  category: ErrorCategory;
  code: string;
  message: string;
  httpStatus?: number;
  stack?: string;
}

export interface JobConfig {
  maxRetries: number;
  retryBaseDelay: number;
  retryMultiplier: number;
  rateLimit: number;
  concurrentDomains: number;
  proxyEnabled: boolean;
  timeout: number;
}

export interface ScrapeTask {
  id: string;
  url: string;
  status: TaskStatus;
  retryCount: number;
  error: TaskError | null;
  productId: string | null;
  duration: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ScrapeJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  totalUrls: number;
  completedUrls: number;
  failedUrls: number;
  tasks: ScrapeTask[];
  config: JobConfig;
}

export const DEFAULT_JOB_CONFIG: JobConfig = {
  maxRetries: 3,
  retryBaseDelay: 2000,
  retryMultiplier: 2,
  rateLimit: 1,
  concurrentDomains: 5,
  proxyEnabled: false,
  timeout: 30000,
};
