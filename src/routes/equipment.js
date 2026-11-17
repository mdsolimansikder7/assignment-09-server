import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyOwner, verifyOwnerOrAdmin } from "../middlewares/verifyRole.js";
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

// Static paths must be declared before "/:id".
equipmentRouter.get("/", asyncHandler(listEquipment));
equipmentRouter.get("/featured", asyncHandler(listFeaturedEquipment));
equipmentRouter.get("/categories", asyncHandler(listCategories));

equipmentRouter.get("/owner/mine", verifyToken, verifyOwner, asyncHandler(listMyEquipment));

equipmentRouter.post("/", verifyToken, verifyOwner, asyncHandler(createEquipment));

equipmentRouter.get("/:id", verifyToken, asyncHandler(getEquipmentById));
equipmentRouter.patch("/:id", verifyToken, verifyOwnerOrAdmin, asyncHandler(updateEquipment));
equipmentRouter.delete("/:id", verifyToken, verifyOwnerOrAdmin, asyncHandler(deleteEquipment));
