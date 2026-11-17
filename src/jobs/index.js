import cron from "node-cron";
import { updateCompletedBookings } from "./updateBookings.js";

/**
 * Starts the daily cleanup job. Serverless hosts such as Vercel do not run
 * persistent cron jobs, so the scheduler is skipped there; call
 * POST /api/jobs/update-bookings from an external scheduler instead.
 */
export function startJobs() {
  if (process.env.VERCEL === "1") {
    console.log("[jobs] Serverless environment detected, cron disabled (use /api/jobs/update-bookings)");
    return;
  }

  // Every day at 00:05 server time.
  cron.schedule("5 0 * * *", async () => {
    try {
      const result = await updateCompletedBookings();
      console.log(`[jobs] update-bookings completed: ${result.completed}`);
    } catch (error) {
      console.error(`[jobs] update-bookings failed: ${error.message}`);
    }
  });
  console.log("[jobs] Daily update-bookings cron scheduled");
}
