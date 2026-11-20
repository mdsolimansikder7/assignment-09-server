import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyCustomer, verifyOwner, verifyOwnerOrAdmin, authorizeRoles } from "../middlewares/verifyRole.js";
import {
  createEquipment,
  deleteEquipment,
  getEquipmentById,
  listCategories,
  listEquipment,
  listFeaturedEquipment,
  listMyEquipment,
  updateEquipment,
} from "../controllers/equipment.controller.js";
import {
  canReviewEquipment,
  createEquipmentReview,
  listEquipmentReviews,
} from "../controllers/reviews.controller.js";

export const equipmentRouter = Router();

equipmentRouter.get("/", asyncHandler(listEquipment));
equipmentRouter.get("/featured", asyncHandler(listFeaturedEquipment));
equipmentRouter.get("/categories", asyncHandler(listCategories));

equipmentRouter.get("/owner/mine", verifyToken, verifyOwner, asyncHandler(listMyEquipment));

equipmentRouter.get("/:id/reviews", asyncHandler(listEquipmentReviews));
equipmentRouter.get("/:id/reviews/can-review", verifyToken, asyncHandler(canReviewEquipment));
equipmentRouter.post("/:id/reviews", verifyToken, verifyCustomer, asyncHandler(createEquipmentReview));

equipmentRouter.post("/", verifyToken, verifyOwner, asyncHandler(createEquipment));

equipmentRouter.get(
  "/:id",
  verifyToken,
  authorizeRoles("customer", "owner", "admin"),
  asyncHandler(getEquipmentById),
);
equipmentRouter.patch("/:id", verifyToken, verifyOwnerOrAdmin, asyncHandler(updateEquipment));
equipmentRouter.delete("/:id", verifyToken, verifyOwnerOrAdmin, asyncHandler(deleteEquipment));
