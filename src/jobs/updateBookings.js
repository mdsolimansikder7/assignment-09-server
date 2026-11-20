import { getDb } from "../config/db.js";
import { sendRentalCompletedEmails } from "../services/email.js";

const BOOKINGS_COLLECTION = "bookings";
const ACTIVE_STATUSES = ["confirmed", "active"];

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

  const ids = due.map((booking) => booking._id);
  const result = await bookings.updateMany(
    { _id: { $in: ids }, bookingStatus: { $in: ACTIVE_STATUSES } },
    { $set: { bookingStatus: "completed", completedAt: now, updatedAt: now } },
  );

  if (result.modifiedCount > 0) {
    // Only email bookings that were actually transitioned by this run.
    const transitioned = due.filter((booking) => ACTIVE_STATUSES.includes(booking.bookingStatus));
    await Promise.allSettled(
      transitioned.map((booking) =>
        sendRentalCompletedEmails({ ...booking, bookingStatus: "completed", completedAt: now }),
      ),
    );
  }

  return { completed: result.modifiedCount || 0 };
}
