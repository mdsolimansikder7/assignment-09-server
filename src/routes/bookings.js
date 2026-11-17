import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyCustomer, verifyOwner } from "../middlewares/verifyRole.js";
import {
  checkout,
  listMyBookings,
  listOwnerBookings,
} from "../controllers/bookings.controller.js";

export const bookingsRouter = Router();

bookingsRouter.post("/checkout", verifyToken, verifyCustomer, asyncHandler(checkout));
bookingsRouter.get("/mine", verifyToken, verifyCustomer, asyncHandler(listMyBookings));
bookingsRouter.get("/owner", verifyToken, verifyOwner, asyncHandler(listOwnerBookings));
