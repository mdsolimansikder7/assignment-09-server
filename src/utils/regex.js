/**
 * Escapes user input before it is used inside a RegExp so that
 * characters like "." or "*" cannot break or abuse the query.
 */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
