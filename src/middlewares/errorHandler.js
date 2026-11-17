import { env } from "../config/env.js";

/**
 * Maps known error types to HTTP status codes so clients never receive
 * an unexpected 500 for a predictable failure.
 */
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

  // Never leak internal error details in production.
  if (status >= 500 && env.isProduction) {
    return "Internal server error";
  }

  return error.message || "Internal server error";
}

/**
 * Central error handler. Keeps responses consistent and never leaks
 * stack traces in production.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  const status = resolveStatus(error);
  const message = resolveMessage(error, status);

  // Stack traces only in development; secrets are never logged.
  const detail = status >= 500 && !env.isProduction && error.stack ? `: ${error.stack}` : "";
  console.error(`[error] ${req.method} ${req.originalUrl} -> ${status}${detail}`);

  res.status(status).json({ success: false, message });
}
