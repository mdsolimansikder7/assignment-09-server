import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import {
  deleteReview,
  updateReview,
} from "../controllers/reviews.controller.js";

export const reviewsRouter = Router();

reviewsRouter.patch("/:reviewId", verifyToken, asyncHandler(updateReview));
reviewsRouter.delete("/:reviewId", verifyToken, asyncHandler(deleteReview));
