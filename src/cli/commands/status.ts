import { Command } from "commander";
import chalk from "chalk";
import {
  loadProducts,
  loadJobs,
  getProductCount,
} from "../../store/local-store.js";
import { checkEngineHealth } from "../../core/scrape-bridge.js";
import { getUserAgentCount } from "../../core/ua-pool.js";

export const statusCommand = new Command("status")
  .description("Show HarvestHub system status")
  .action(async () => {
    console.log(chalk.bold.hex("#1A1A2E")("\n  🌾 HarvestHub Status\n"));

    // Engine health
    const engineOk = await checkEngineHealth();
    console.log(
      `  Python Engine:   ${engineOk ? chalk.green("✓ Ready") : chalk.red("✗ Not available")}`,
    );
    console.log(`  User Agents:     ${chalk.dim(String(getUserAgentCount()))}`);

    // Store stats
    const productCount = await getProductCount();
    const jobs = await loadJobs();
    const lastJob = jobs.at(-1);

    console.log(`  Stored Products: ${chalk.bold(String(productCount))}`);
    console.log(`  Total Jobs:      ${chalk.dim(String(jobs.length))}`);

    if (lastJob) {
      console.log(
        `  Last Job:        ${lastJob.status} (${lastJob.completedUrls}/${lastJob.totalUrls} URLs)`,
      );
      console.log(
        `  Last Run:        ${lastJob.completedAt ?? lastJob.startedAt ?? "N/A"}`,
      );
    }

    // Quick tips
    console.log(chalk.dim("\n  Commands:"));
    console.log(
      chalk.dim("    harvest scrape --urls urls.txt     Scrape products"),
    );
    console.log(
      chalk.dim("    harvest export -f xlsx             Export to Excel"),
    );
    console.log(
      chalk.dim("    harvest export -f gmc              Export GMC feed"),
    );
    console.log(
      chalk.dim("    harvest migrate                    Import legacy data"),
    );
    console.log("");
  });
