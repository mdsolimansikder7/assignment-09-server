import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loginWithJwt, logout } from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.post("/jwt", asyncHandler(loginWithJwt));
authRouter.post("/logout", logout);
