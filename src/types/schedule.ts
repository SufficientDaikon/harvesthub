import type { JobConfig, JobStatus } from "./job.js";

export interface Schedule {
  id: string;
  name: string;
  cronExpression: string;
  urlSource: string;
  config: JobConfig;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: JobStatus | null;
  createdAt: string;
}
