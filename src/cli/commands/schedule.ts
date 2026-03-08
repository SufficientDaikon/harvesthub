import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { nanoid } from "nanoid";
import {
  loadSchedules,
  saveSchedule,
  deleteSchedule,
} from "../../store/local-store.js";
import {
  startAllSchedules,
  syncSchedule,
  stopScheduleJob,
  getActiveScheduleIds,
} from "../../core/scheduler.js";
import { DEFAULT_JOB_CONFIG } from "../../types/index.js";
import type { Schedule } from "../../types/index.js";

export const scheduleCommand = new Command("schedule").description(
  "Manage scheduled scraping jobs",
);

// ── list ────────────────────────────────────────────────────────────────
scheduleCommand
  .command("list")
  .description("List all schedules")
  .action(async () => {
    const schedules = await loadSchedules();

    if (schedules.length === 0) {
      console.log(chalk.dim("\n  No schedules configured.\n"));
      console.log(
        chalk.dim(
          "  Create one: harvest schedule add --name 'Daily scrape' --cron '0 9 * * *' --urls urls.txt\n",
        ),
      );
      return;
    }

    console.log(chalk.bold("\n  📅 Scheduled Jobs\n"));
    console.log(
      chalk.dim(
        "  " +
          "ID".padEnd(14) +
          "Name".padEnd(24) +
          "Cron".padEnd(18) +
          "Enabled".padEnd(10) +
          "Last Run".padEnd(22) +
          "Status",
      ),
    );
    console.log(chalk.dim("  " + "─".repeat(100)));

    const active = getActiveScheduleIds();

    for (const s of schedules) {
      const enabled = s.enabled ? chalk.green("● yes") : chalk.dim("○ no ");
      const lastRun = s.lastRunAt
        ? new Date(s.lastRunAt).toLocaleString()
        : chalk.dim("never");
      const status = s.lastRunStatus
        ? s.lastRunStatus === "completed"
          ? chalk.green(s.lastRunStatus)
          : chalk.red(s.lastRunStatus)
        : chalk.dim("—");
      const running = active.includes(s.id) ? chalk.cyan(" ⟳") : "";

      console.log(
        `  ${chalk.hex("#888")(s.id.slice(0, 12).padEnd(14))}${s.name.slice(0, 22).padEnd(24)}${s.cronExpression.padEnd(18)}${enabled.padEnd(10)}  ${String(lastRun).padEnd(22)}${status}${running}`,
      );
    }
    console.log("");
  });

// ── add ─────────────────────────────────────────────────────────────────
scheduleCommand
  .command("add")
  .description("Create a new schedule")
  .requiredOption("-n, --name <name>", "Schedule name")
  .requiredOption(
    "-c, --cron <expression>",
    "Cron expression (e.g., '0 9 * * *' for 9 AM daily)",
  )
  .requiredOption(
    "-u, --urls <source>",
    "URL source: file path (.txt) or comma-separated URLs",
  )
  .option("-r, --retries <n>", "Max retries per URL", "3")
  .option("-t, --timeout <ms>", "Request timeout in ms", "30000")
  .option("--disabled", "Create in disabled state", false)
  .action(async (opts) => {
    const spinner = ora("Creating schedule...").start();

    const schedule: Schedule = {
      id: nanoid(12),
      name: opts.name,
      cronExpression: opts.cron,
      urlSource: opts.urls,
      config: {
        ...DEFAULT_JOB_CONFIG,
        maxRetries: parseInt(opts.retries, 10),
        timeout: parseInt(opts.timeout, 10),
      },
      enabled: !opts.disabled,
      lastRunAt: null,
      lastRunStatus: null,
      createdAt: new Date().toISOString(),
    };

    await saveSchedule(schedule);

    if (schedule.enabled) {
      await syncSchedule(schedule);
    }

    spinner.succeed(
      `Schedule created: ${chalk.bold(schedule.name)} (${schedule.id})`,
    );
    console.log(chalk.dim(`  Cron:    ${schedule.cronExpression}`));
    console.log(chalk.dim(`  Source:  ${schedule.urlSource}`));
    console.log(chalk.dim(`  Enabled: ${schedule.enabled}`));
    console.log("");
  });

// ── remove ──────────────────────────────────────────────────────────────
scheduleCommand
  .command("remove <id>")
  .description("Delete a schedule by ID")
  .action(async (id: string) => {
    const spinner = ora("Removing schedule...").start();
    stopScheduleJob(id);
    const removed = await deleteSchedule(id);
    if (removed) {
      spinner.succeed(`Schedule ${id} removed`);
    } else {
      spinner.fail(`Schedule ${id} not found`);
    }
  });

// ── enable / disable ────────────────────────────────────────────────────
scheduleCommand
  .command("enable <id>")
  .description("Enable a schedule")
  .action(async (id: string) => {
    const schedules = await loadSchedules();
    const schedule = schedules.find((s) => s.id === id);
    if (!schedule) {
      console.log(chalk.red(`\n  Schedule ${id} not found.\n`));
      return;
    }
    schedule.enabled = true;
    await saveSchedule(schedule);
    await syncSchedule(schedule);
    console.log(chalk.green(`\n  ✓ Schedule "${schedule.name}" enabled.\n`));
  });

scheduleCommand
  .command("disable <id>")
  .description("Disable a schedule")
  .action(async (id: string) => {
    const schedules = await loadSchedules();
    const schedule = schedules.find((s) => s.id === id);
    if (!schedule) {
      console.log(chalk.red(`\n  Schedule ${id} not found.\n`));
      return;
    }
    schedule.enabled = false;
    await saveSchedule(schedule);
    stopScheduleJob(schedule.id);
    console.log(chalk.yellow(`\n  ○ Schedule "${schedule.name}" disabled.\n`));
  });

// ── start (activate all enabled schedules) ──────────────────────────────
scheduleCommand
  .command("start")
  .description("Start all enabled schedules (runs in foreground)")
  .action(async () => {
    console.log(chalk.bold("\n  📅 Starting scheduler...\n"));
    await startAllSchedules();

    const active = getActiveScheduleIds();
    if (active.length === 0) {
      console.log(
        chalk.dim("  No enabled schedules. Use: harvest schedule add ...\n"),
      );
      return;
    }

    console.log(
      chalk.green(
        `  ${active.length} schedule(s) active. Press Ctrl+C to stop.\n`,
      ),
    );

    // Keep process alive
    await new Promise(() => {});
  });
