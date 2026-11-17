import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";
import {
  deleteUser,
  getMe,
  listUsers,
  updateMe,
  updateUserRole,
} from "../controllers/users.controller.js";

export const usersRouter = Router();

// Every users route requires a valid token.
usersRouter.use(verifyToken);

usersRouter.get("/me", getMe);
usersRouter.patch("/me", asyncHandler(updateMe));

usersRouter.get("/", verifyAdmin, asyncHandler(listUsers));
usersRouter.patch("/:id/role", verifyAdmin, asyncHandler(updateUserRole));
usersRouter.delete("/:id", verifyAdmin, asyncHandler(deleteUser));
