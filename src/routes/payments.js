import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyCustomer } from "../middlewares/verifyRole.js";
import { verifyPayment } from "../controllers/payments.controller.js";

export const paymentsRouter = Router();

// The webhook is mounted directly in app.js because it needs the raw body.
paymentsRouter.get(
  "/verify/:sessionId",
  verifyToken,
  verifyCustomer,
  asyncHandler(verifyPayment),
);
