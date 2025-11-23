import cron from "node-cron";
import { distributeDailyProfits } from "../services/dailyProfitService.js";

/**
 * Start the daily profit distribution cron job
 * Runs at midnight every day (00:00)
 */
export function startDailyProfitJob() {
  // Run at midnight every day
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("[DailyProfitJob] Starting daily profit distribution...");
      try {
        const result = await distributeDailyProfits();
        console.log("[DailyProfitJob] Distribution complete:", result);
      } catch (error) {
        console.error("[DailyProfitJob] Distribution failed:", error);
      }
    },
    {
      timezone: "Asia/Dubai", // Adjust based on your timezone
    }
  );

  console.log("[DailyProfitJob] Cron job scheduled for midnight (00:00) daily");

  // Optional: Run immediately on startup for testing
  // Uncomment the following lines to run distribution on server start
  // setTimeout(async () => {
  //   console.log('[DailyProfitJob] Running initial distribution...');
  //   try {
  //     await distributeDailyProfits();
  //   } catch (error) {
  //     console.error('[DailyProfitJob] Initial distribution failed:', error);
  //   }
  // }, 5000);
}

/**
 * Manually trigger daily profit distribution
 * Can be called via an admin API endpoint if needed
 */
export async function triggerManualDistribution() {
  console.log("[DailyProfitJob] Manual distribution triggered");
  return await distributeDailyProfits();
}
