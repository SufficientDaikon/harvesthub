import { Cron } from "croner";
import { nanoid } from "nanoid";
import { loadSchedules, saveSchedule } from "../store/local-store.js";
import { parseUrlFile, parseUrlString } from "../lib/url-parser.js";
import { runScrapeJob } from "./job-runner.js";
import { createChildLogger } from "../lib/logger.js";
import type { Schedule } from "../types/index.js";

const log = createChildLogger("scheduler");

const activeJobs = new Map<string, Cron>();

/** Start a cron job for a single schedule. */
function startScheduleJob(schedule: Schedule): void {
  if (activeJobs.has(schedule.id)) return;

  let job: Cron;
  try {
    job = new Cron(schedule.cronExpression, { protect: true }, async () => {
      log.info(
        { scheduleId: schedule.id, name: schedule.name },
        "Cron triggered",
      );

      // Resolve URLs from the source (file path or comma-separated)
      let urls: string[] = [];
      try {
        if (
          schedule.urlSource.endsWith(".txt") ||
          schedule.urlSource.includes("/")
        ) {
          const parsed = await parseUrlFile(schedule.urlSource);
          urls = parsed.valid;
        } else {
          const parsed = parseUrlString(schedule.urlSource);
          urls = parsed.valid;
        }
      } catch (err) {
        log.error(
          { err, scheduleId: schedule.id },
          "Failed to parse URL source",
        );
        return;
      }

      if (urls.length === 0) {
        log.warn(
          { scheduleId: schedule.id },
          "No valid URLs for scheduled job",
        );
        return;
      }

      try {
        const result = await runScrapeJob(urls, {
          maxRetries: schedule.config.maxRetries,
          timeout: schedule.config.timeout,
        });

        // Persist last run info
        const updated: Schedule = {
          ...schedule,
          lastRunAt: new Date().toISOString(),
          lastRunStatus: result.errors.length === 0 ? "completed" : "failed",
        };
        await saveSchedule(updated);
        log.info(
          {
            scheduleId: schedule.id,
            products: result.products.length,
            errors: result.errors.length,
          },
          "Scheduled job finished",
        );
      } catch (err) {
        log.error(
          { err, scheduleId: schedule.id },
          "Scheduled scrape job failed",
        );
        const updated: Schedule = {
          ...schedule,
          lastRunAt: new Date().toISOString(),
          lastRunStatus: "failed",
        };
        await saveSchedule(updated);
      }
    });
  } catch (err) {
    log.error(
      { err, scheduleId: schedule.id, cron: schedule.cronExpression },
      "Invalid cron expression",
    );
    return;
  }

  activeJobs.set(schedule.id, job);
  log.info(
    {
      scheduleId: schedule.id,
      name: schedule.name,
      cron: schedule.cronExpression,
    },
    "Schedule started",
  );
}

/** Stop a cron job by schedule ID. */
export function stopScheduleJob(scheduleId: string): void {
  const job = activeJobs.get(scheduleId);
  if (job) {
    job.stop();
    activeJobs.delete(scheduleId);
    log.info({ scheduleId }, "Schedule stopped");
  }
}

/** Load all enabled schedules from the store and start them. */
export async function startAllSchedules(): Promise<void> {
  const schedules = await loadSchedules();
  const enabled = schedules.filter((s) => s.enabled);
  if (enabled.length === 0) {
    log.info("No enabled schedules found");
    return;
  }
  for (const schedule of enabled) {
    startScheduleJob(schedule);
  }
  log.info({ count: enabled.length }, "Schedules loaded");
}

/** Register a new or updated schedule — starts it if enabled, stops it if disabled. */
export async function syncSchedule(schedule: Schedule): Promise<void> {
  stopScheduleJob(schedule.id);
  if (schedule.enabled) {
    startScheduleJob(schedule);
  }
}

export function getActiveScheduleIds(): string[] {
  return Array.from(activeJobs.keys());
}
