import { env } from "../config/env.js";

function resolveStatus(error) {
  if (error.type === "entity.parse.failed") return 400;
  if (error.type === "entity.too.large") return 413;
  if (error.code === 11000) return 409;

  const status = error.status || error.statusCode || 500;
  if (status >= 500 && error.type === "StripeInvalidRequestError") return 502;

  return status;
}

function resolveMessage(error, status) {
  if (error.type === "entity.parse.failed") return "Invalid JSON body";
  if (error.type === "entity.too.large") return "Request body is too large";
  if (error.code === 11000) return "Resource already exists";

  if (status >= 500 && env.isProduction) {
    return "Internal server error";
  }

  return error.message || "Internal server error";
}

export function errorHandler(error, req, res, next) {
  const status = resolveStatus(error);
  const message = resolveMessage(error, status);

  const detail = status >= 500 && !env.isProduction && error.stack ? `: ${error.stack}` : "";
  console.error(`[error] ${req.method} ${req.originalUrl} -> ${status}${detail}`);

  res.status(status).json({ success: false, message });
}
