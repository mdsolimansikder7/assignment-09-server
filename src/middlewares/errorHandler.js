import { env } from "../config/env.js";

/**
 * Central error handler. Keeps responses consistent and never leaks
 * stack traces or internal details when running in production.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  const status = error.status || error.statusCode || 500;
  const isServerError = status >= 500;

  // Malformed JSON bodies are client errors, not server errors.
  const resolvedStatus = error.type === "entity.parse.failed" ? 400 : status;
  const message =
    resolvedStatus >= 500 && env.isProduction
      ? "Internal server error"
      : error.type === "entity.parse.failed"
        ? "Invalid JSON body"
        : error.message || "Internal server error";

  console.error(
    `[error] ${req.method} ${req.originalUrl} -> ${resolvedStatus}${
      isServerError && !env.isProduction ? `: ${error.stack}` : ""
    }`,
  );

  res.status(resolvedStatus).json({ success: false, message });
}
