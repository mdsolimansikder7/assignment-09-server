import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { equipmentRouter } from "./routes/equipment.js";
import { favoritesRouter } from "./routes/favorites.js";
import { bookingsRouter } from "./routes/bookings.js";
import { paymentsRouter } from "./routes/payments.js";
import { adminRouter } from "./routes/admin.js";
import { stripeWebhook } from "./controllers/payments.controller.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

// Required for reverse proxies (Vercel, Render, etc.) so secure cookies
// and protocol detection work correctly in production.
app.set("trust proxy", 1);

const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin/server-to-server requests (no Origin header).
    if (!origin) return callback(null, true);
    if (env.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Answer every preflight request (OPTIONS) before it reaches the routers.
app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

// NOTE: the Stripe webhook must receive the raw body, so it is mounted
// before express.json(). Do not move this block below the JSON parser.
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(stripeWebhook),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Equipment Rental API is running",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/equipment", equipmentRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
