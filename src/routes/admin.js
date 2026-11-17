import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";
import {
  listAllEquipment,
  updateEquipmentStatus,
} from "../controllers/admin.controller.js";

export const adminRouter = Router();

// Every admin route requires a valid token with the admin role.
adminRouter.use(verifyToken, verifyAdmin);

adminRouter.get("/equipment", asyncHandler(listAllEquipment));
adminRouter.patch("/equipment/:id/status", asyncHandler(updateEquipmentStatus));
