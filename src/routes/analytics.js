import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin, verifyCustomer, verifyOwner } from "../middlewares/verifyRole.js";
import {
  adminAnalytics,
  customerAnalytics,
  ownerAnalytics,
} from "../controllers/analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.use(verifyToken);

analyticsRouter.get("/admin", verifyAdmin, asyncHandler(adminAnalytics));
analyticsRouter.get("/owner", verifyOwner, asyncHandler(ownerAnalytics));
analyticsRouter.get("/customer", verifyCustomer, asyncHandler(customerAnalytics));
