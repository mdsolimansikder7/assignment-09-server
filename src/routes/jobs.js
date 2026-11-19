import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";
import { updateCompletedBookings } from "../jobs/updateBookings.js";

export const jobsRouter = Router();

jobsRouter.use(verifyToken, verifyAdmin);

async function runUpdateBookings(req, res) {
  const result = await updateCompletedBookings();
  res.status(200).json({ success: true, completed: result.completed });
}

jobsRouter.post("/update-bookings", asyncHandler(runUpdateBookings));
jobsRouter.get("/update-bookings", asyncHandler(runUpdateBookings));
