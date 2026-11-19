import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyOwner, verifyOwnerOrAdmin, authorizeRoles } from "../middlewares/verifyRole.js";
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

export const equipmentRouter = Router();

equipmentRouter.get("/", asyncHandler(listEquipment));
equipmentRouter.get("/featured", asyncHandler(listFeaturedEquipment));
equipmentRouter.get("/categories", asyncHandler(listCategories));

equipmentRouter.get("/owner/mine", verifyToken, verifyOwner, asyncHandler(listMyEquipment));

equipmentRouter.post("/", verifyToken, verifyOwner, asyncHandler(createEquipment));

equipmentRouter.get(
  "/:id",
  verifyToken,
  authorizeRoles("customer", "owner", "admin"),
  asyncHandler(getEquipmentById),
);
equipmentRouter.patch("/:id", verifyToken, verifyOwnerOrAdmin, asyncHandler(updateEquipment));
equipmentRouter.delete("/:id", verifyToken, verifyOwnerOrAdmin, asyncHandler(deleteEquipment));
