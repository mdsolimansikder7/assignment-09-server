const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Number of rental days between two dates. A same-day rental counts as
 * one day instead of zero.
 */
export function daysBetween(startDate, endDate) {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS);
  return Math.max(1, days);
}

/**
 * Server-side price calculation. Billing units depend on the rental type:
 * weekly and monthly rentals charge whole periods and round up.
 */
export function calculateTotal({ rentalType, rentalPrice, days, quantity }) {
  let units = days;

  if (rentalType === "weekly") units = Math.ceil(days / 7);
  if (rentalType === "monthly") units = Math.ceil(days / 30);

  const total = units * rentalPrice * quantity;

  // Avoid floating point artifacts in money values.
  return Math.round(total * 100) / 100;
}
