import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyCustomer } from "../middlewares/verifyRole.js";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from "../controllers/favorites.controller.js";

export const favoritesRouter = Router();

favoritesRouter.use(verifyToken, verifyCustomer);

favoritesRouter.post("/", asyncHandler(addFavorite));
favoritesRouter.get("/", asyncHandler(listFavorites));
favoritesRouter.delete("/:equipmentId", asyncHandler(removeFavorite));
