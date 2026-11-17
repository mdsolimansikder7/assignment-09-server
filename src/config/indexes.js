/**
 * Creates the indexes the API relies on. Called once after the
 * database connection is established.
 */
export async function ensureIndexes(db) {
  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  await db.collection("equipment").createIndex({ status: 1 });
  await db.collection("equipment").createIndex({ category: 1 });
  await db.collection("equipment").createIndex({ "owner.email": 1 });

  await db.collection("favorites").createIndex(
    { userEmail: 1, equipmentId: 1 },
    { unique: true },
  );

  await db.collection("bookings").createIndex({ "customer.email": 1 });
  await db.collection("bookings").createIndex({ ownerEmail: 1 });
  await db.collection("bookings").createIndex({ stripeSessionId: 1 });
  // Speeds up the date-range availability lookup.
  await db.collection("bookings").createIndex({
    equipmentId: 1,
    bookingStatus: 1,
    startDate: 1,
    endDate: 1,
  });

  await db.collection("payments").createIndex({ stripeSessionId: 1 }, { unique: true });
  await db.collection("payments").createIndex({ bookingId: 1 });
  await db.collection("payments").createIndex({ ownerEmail: 1 });
}
