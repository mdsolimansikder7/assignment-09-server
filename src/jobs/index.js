import cron from "node-cron";
import { updateCompletedBookings } from "./updateBookings.js";

export function startJobs() {
  if (process.env.VERCEL === "1") {
    console.log("[jobs] Serverless environment detected, cron disabled (use /api/jobs/update-bookings)");
    return;
  }

  cron.schedule("5 0 * * *", async () => {
    try {
      const result = await updateCompletedBookings();
      console.log(`[jobs] update-bookings completed: ${result.completed}`);
    } catch (error) {
      console.error(`[jobs] update-bookings failed: ${error.message}`);
    }
  });
}
