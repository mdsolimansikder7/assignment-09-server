/**
 * Wraps async route handlers so rejected promises reach the
 * central error handler instead of hanging the request.
 */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
