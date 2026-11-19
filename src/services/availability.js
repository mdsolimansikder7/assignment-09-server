const BOOKINGS_COLLECTION = "bookings";

const RESERVING_STATUSES = ["confirmed", "active"];

export async function getReservedQuantity(db, equipmentId, startDate, endDate) {
  const [row] = await db
    .collection(BOOKINGS_COLLECTION)
    .aggregate([
      {
        $match: {
          equipmentId,
          bookingStatus: { $in: RESERVING_STATUSES },
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
        },
      },
      { $group: { _id: null, reserved: { $sum: "$quantity" } } },
    ])
    .toArray();

  return row?.reserved || 0;
}

export async function getAvailableQuantity(db, equipment, startDate, endDate) {
  const reserved = await getReservedQuantity(db, equipment._id, startDate, endDate);
  return Math.max(0, equipment.availableQuantity - reserved);
}
