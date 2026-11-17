import { getDb } from "../config/db.js";
import { sendRentalCompletedEmails } from "../services/email.js";

const BOOKINGS_COLLECTION = "bookings";
const ACTIVE_STATUSES = ["confirmed", "active"];

/**
 * Marks paid bookings as completed once their end date has passed.
 * Completed bookings are no longer counted by the availability service,
 * so the reserved quantity is returned to the equipment automatically.
 */
export async function updateCompletedBookings() {
  const db = await getDb();
  const bookings = db.collection(BOOKINGS_COLLECTION);
  const now = new Date();

  const due = await bookings
    .find({ bookingStatus: { $in: ACTIVE_STATUSES }, endDate: { $lt: now } })
    .toArray();

  if (due.length === 0) {
    return { completed: 0 };
  }

  await bookings.updateMany(
    { _id: { $in: due.map((booking) => booking._id) }, bookingStatus: { $in: ACTIVE_STATUSES } },
    { $set: { bookingStatus: "completed", updatedAt: now } },
  );

  // Notifications must never fail the job itself.
  await Promise.allSettled(
    due.map((booking) => sendRentalCompletedEmails(booking)),
  );

  return { completed: due.length };
}
