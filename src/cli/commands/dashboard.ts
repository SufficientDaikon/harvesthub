import { Command } from "commander";
import chalk from "chalk";

export const dashboardCommand = new Command("dashboard")
  .description("Start the HarvestHub web dashboard")
  .option("-p, --port <port>", "Port number", "3000")
  .action(async (opts) => {
    console.log(chalk.bold.hex("#1A1A2E")("\n  🌾 HarvestHub Dashboard\n"));

    const port = parseInt(opts.port, 10);

    // Dynamic import to avoid loading express until needed
    const { createServer } = await import("../../api/server.js");
    createServer(port);
  });
