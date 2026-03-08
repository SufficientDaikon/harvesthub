#!/usr/bin/env node
import { Command } from "commander";
import { scrapeCommand } from "./commands/scrape.js";
import { exportCommand } from "./commands/export.js";
import { statusCommand } from "./commands/status.js";
import { migrateCommand } from "./commands/migrate.js";
import { dashboardCommand } from "./commands/dashboard.js";
import { scheduleCommand } from "./commands/schedule.js";

const program = new Command();

program
  .name("harvest")
  .description("HarvestHub — Adaptive product scraping platform")
  .version("1.0.0");

program.addCommand(scrapeCommand);
program.addCommand(exportCommand);
program.addCommand(statusCommand);
program.addCommand(migrateCommand);
program.addCommand(dashboardCommand);
program.addCommand(scheduleCommand);

program.parse();
