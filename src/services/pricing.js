const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(startDate, endDate) {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS);
  return Math.max(1, days);
}

export function calculateTotal({ rentalType, rentalPrice, days, quantity }) {
  let units = days;

  if (rentalType === "weekly") units = Math.ceil(days / 7);
  if (rentalType === "monthly") units = Math.ceil(days / 30);

  const total = units * rentalPrice * quantity;

  return Math.round(total * 100) / 100;
}
