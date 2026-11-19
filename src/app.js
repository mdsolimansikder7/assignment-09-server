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
import { analyticsRouter } from "./routes/analytics.js";
import { notificationsRouter } from "./routes/notifications.js";
import { jobsRouter } from "./routes/jobs.js";
import { adminRouter } from "./routes/admin.js";
import { stripeWebhook } from "./controllers/payments.controller.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, env.allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

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
app.use("/api/analytics", analyticsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
