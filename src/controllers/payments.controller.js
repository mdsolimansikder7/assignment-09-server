import { getDb } from "../config/db.js";
import { env } from "../config/env.js";
import { getStripe } from "../config/stripe.js";
import { toObjectId } from "../utils/objectId.js";
import { serializeBooking } from "../utils/serialize.js";

const BOOKINGS_COLLECTION = "bookings";
const PAYMENTS_COLLECTION = "payments";

/**
 * Marks a booking paid and stores the payment exactly once.
 * Safe to call from both the webhook and the verify endpoint:
 * the conditional update guarantees idempotency.
 */
async function completePayment(session) {
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    console.warn("[stripe] Session without bookingId metadata ignored");
    return null;
  }

  const db = await getDb();
  const bookings = db.collection(BOOKINGS_COLLECTION);
  const booking = await bookings.findOne({ _id: toObjectId(bookingId, "booking id") });

  if (!booking) {
    console.warn(`[stripe] Booking ${bookingId} not found for session ${session.id}`);
    return null;
  }

  // Already processed: do nothing (webhooks are retried by Stripe).
  if (booking.paymentStatus === "paid") {
    return booking;
  }

  const now = new Date();

  // Confirming the booking reserves the stock: availability subtracts
  // confirmed/active bookings, so the quantity is never double counted.
  const updatedBooking = await bookings.findOneAndUpdate(
    { _id: booking._id, paymentStatus: { $ne: "paid" } },
    {
      $set: {
        paymentStatus: "paid",
        bookingStatus: "confirmed",
        stripeSessionId: session.id,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!updatedBooking) {
    // Another request won the race; nothing left to do.
    return booking;
  }

  await db.collection(PAYMENTS_COLLECTION).updateOne(
    { stripeSessionId: session.id },
    {
      $setOnInsert: {
        bookingId: booking._id,
        customerEmail: booking.customer?.email || "",
        ownerEmail: booking.ownerEmail || "",
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency || "usd",
        transactionId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || "",
        stripeSessionId: session.id,
        status: session.payment_status || "paid",
        paidAt: now,
      },
    },
    { upsert: true },
  );

  return updatedBooking;
}

/**
 * Stripe webhook. Must receive the raw body (registered before express.json).
 */
export async function stripeWebhook(req, res) {
  if (!env.stripeWebhookSecret) {
    return res.status(503).json({ success: false, message: "Stripe webhook is not configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ success: false, message: "Missing Stripe signature" });
  }

  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  } catch {
    // Never log the payload: it may contain customer data.
    return res.status(400).json({ success: false, message: "Invalid webhook signature" });
  }

  if (event.type === "checkout.session.completed") {
    await completePayment(event.data.object);
  }

  // Always acknowledge verified events so Stripe stops retrying.
  return res.status(200).json({ received: true });
}

/**
 * Retrieves a Checkout session, mapping Stripe's "no such session"
 * error to a clean 404 instead of a 500.
 */
async function retrieveSession(stripe, sessionId) {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if (error.code === "resource_missing" || error.statusCode === 404) {
      const notFound = new Error("Payment session not found");
      notFound.status = 404;
      throw notFound;
    }
    throw error;
  }
}

/**
 * Fallback used by the payment success page. Verifies the session with
 * Stripe directly when the webhook has not arrived yet.
 */
export async function verifyPayment(req, res) {
  const { sessionId } = req.params;

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ success: false, message: "Invalid session id" });
  }

  const db = await getDb();
  let booking = await db.collection(BOOKINGS_COLLECTION).findOne({ stripeSessionId: sessionId });
  let session = null;

  const stripe = getStripe();

  if (!booking) {
    session = await retrieveSession(stripe, sessionId);

    if (!session?.metadata?.bookingId) {
      return res.status(404).json({ success: false, message: "Booking not found for this session" });
    }

    booking = await db
      .collection(BOOKINGS_COLLECTION)
      .findOne({ _id: toObjectId(session.metadata.bookingId, "booking id") });
  }

  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }

  if (booking.customer?.email !== req.user.email) {
    return res.status(403).json({ success: false, message: "This booking belongs to another customer" });
  }

  if (booking.paymentStatus !== "paid") {
    session = session || (await retrieveSession(stripe, sessionId));
    if (session.payment_status === "paid") {
      booking = (await completePayment(session)) || booking;
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      booking: serializeBooking(booking),
      sessionStatus: session?.payment_status || booking.paymentStatus,
    },
  });
}
