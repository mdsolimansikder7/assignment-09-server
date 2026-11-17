const BOOKINGS_COLLECTION = "bookings";

// Only paid (confirmed) or currently running rentals hold stock.
const RESERVING_STATUSES = ["confirmed", "active"];

/**
 * Sums the quantity already reserved on an equipment item for a date
 * range that overlaps [startDate, endDate]. Pending and cancelled
 * bookings do not block new reservations.
 */
export async function getReservedQuantity(db, equipmentId, startDate, endDate) {
  const [row] = await db
    .collection(BOOKINGS_COLLECTION)
    .aggregate([
      {
        $match: {
          equipmentId,
          bookingStatus: { $in: RESERVING_STATUSES },
          // Date ranges overlap when one starts before the other ends.
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
        },
      },
      { $group: { _id: null, reserved: { $sum: "$quantity" } } },
    ])
    .toArray();

  return row?.reserved || 0;
}

/**
 * Quantity that can still be booked for the requested dates.
 */
export async function getAvailableQuantity(db, equipment, startDate, endDate) {
  const reserved = await getReservedQuantity(db, equipment._id, startDate, endDate);
  return Math.max(0, equipment.availableQuantity - reserved);
}
