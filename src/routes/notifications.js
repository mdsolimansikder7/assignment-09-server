import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import {
  listNotifications,
  markAllRead,
  markOneRead,
} from "../controllers/notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.use(verifyToken);

notificationsRouter.get("/", asyncHandler(listNotifications));
notificationsRouter.patch("/read-all", asyncHandler(markAllRead));
notificationsRouter.patch("/:id/read", asyncHandler(markOneRead));