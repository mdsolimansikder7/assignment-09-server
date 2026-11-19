import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";
import {
  listAllEquipment,
  updateEquipmentStatus,
} from "../controllers/admin.controller.js";
import {
  listAllBookings,
  updateBookingStatus,
} from "../controllers/bookings.controller.js";

export const adminRouter = Router();

adminRouter.use(verifyToken, verifyAdmin);

adminRouter.get("/equipment", asyncHandler(listAllEquipment));
adminRouter.patch("/equipment/:id/status", asyncHandler(updateEquipmentStatus));

adminRouter.get("/bookings", asyncHandler(listAllBookings));
adminRouter.patch("/bookings/:id", asyncHandler(updateBookingStatus));
