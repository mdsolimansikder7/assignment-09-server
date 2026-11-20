import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";
import { env } from "../config/env.js";
import { getStripe } from "../config/stripe.js";
import { toObjectId } from "../utils/objectId.js";
import { parseOrThrow } from "../utils/validate.js";
import { serializeBooking } from "../utils/serialize.js";
import { z } from "zod";
import { createNotification } from "./notifications.controller.js";

const BOOKINGS_COLLECTION = "bookings";
const PAYMENTS_COLLECTION = "payments";
const USERS_COLLECTION = "users";
const EQUIPMENT_COLLECTION = "equipment";

const sessionIdSchema = z.object({
  session_id: z.string().trim().min(1).max(255),
});

function readMetadataString(metadata, key) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function logMetadataIssue(scope, sessionId, field, value) {
  const safeValue =
    value === undefined ? "undefined" : value === null ? "null" : String(value);
  console.warn(
    `[stripe] ${scope}: missing/invalid metadata field "${field}" for session ${sessionId || "unknown"} (value: ${safeValue})`,
  );
}

async function resolvePaymentTransactionId(stripe, session) {
  const source = session?.payment_intent;
  const sourceId = typeof source === "string" ? source : source?.id || "";
  if (sourceId) return sourceId;

  const sessionId = session?.id;
  if (!sessionId) return "";

  try {
    const full = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
    const pi = full?.payment_intent;
    if (typeof pi === "string") return pi;
    return pi?.id || "";
  } catch (error) {
    console.warn(
      `[stripe] Could not expand payment_intent for session ${sessionId}: ${error?.message || error}`,
    );
    return "";
  }
}

async function findBookingForSession(db, session) {
  const bookings = db.collection(BOOKINGS_COLLECTION);
  const sessionId = session?.id || "";
  const metadata = session?.metadata || {};

  const bookingId = readMetadataString(metadata, "bookingId");
  const equipmentId = readMetadataString(metadata, "equipmentId");
  const startDate = readMetadataString(metadata, "startDate");
  const endDate = readMetadataString(metadata, "endDate");
  const customerEmail = readMetadataString(metadata, "customerEmail");

  if (!bookingId) logMetadataIssue("completePayment", sessionId, "bookingId", metadata?.bookingId);
  if (!equipmentId) logMetadataIssue("completePayment", sessionId, "equipmentId", metadata?.equipmentId);
  if (!startDate) logMetadataIssue("completePayment", sessionId, "startDate", metadata?.startDate);
  if (!endDate) logMetadataIssue("completePayment", sessionId, "endDate", metadata?.endDate);
  if (!customerEmail) logMetadataIssue("completePayment", sessionId, "customerEmail", metadata?.customerEmail);

  let booking = null;

  if (bookingId) {
    if (!ObjectId.isValid(bookingId) || !/^[0-9a-fA-F]{24}$/.test(bookingId)) {
      logMetadataIssue("completePayment", sessionId, "bookingId", bookingId);
    } else {
      booking = await bookings.findOne({ _id: toObjectId(bookingId, "booking id") });
    }
  }

  if (!booking && sessionId) {
    booking = await bookings.findOne({ stripeSessionId: sessionId });
    if (booking) {
      console.warn(`[stripe] completePayment: fell back to booking lookup by stripeSessionId for session ${sessionId}`);
    }
  }

  return booking;
}

async function completePayment(session, stripe = getStripe()) {
  if (!session?.id) {
    console.warn("[stripe] completePayment called without a session id");
    return null;
  }

  const db = await getDb();
  const bookings = db.collection(BOOKINGS_COLLECTION);
  const booking = await findBookingForSession(db, session);

  if (!booking) {
    console.warn(`[stripe] Booking not found for session ${session.id}`);
    return null;
  }

  const transactionId = await resolvePaymentTransactionId(stripe, session);
  const paymentMethod = session?.payment_method_types?.[0] || "card";
  const now = new Date();
  const amount = (session?.amount_total ?? booking.totalAmount ?? 0) / 100;
  const currency = session?.currency || "usd";

  let finalBooking = booking;

  if (booking.paymentStatus !== "paid") {
    const updatedBooking = await bookings.findOneAndUpdate(
      { _id: booking._id, paymentStatus: { $ne: "paid" } },
      {
        $set: {
          paymentStatus: "paid",
          bookingStatus: "confirmed",
          stripeSessionId: session.id,
          transactionId: transactionId || booking.transactionId,
          paidAt: booking.paidAt || now,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );

    if (updatedBooking) finalBooking = updatedBooking;
  }

  const customer = booking.customer?.email
    ? await db.collection(USERS_COLLECTION).findOne({ email: booking.customer.email })
    : null;
  const owner = booking.ownerEmail
    ? await db.collection(USERS_COLLECTION).findOne({ email: booking.ownerEmail })
    : null;

  let equipmentIdValue = null;
  try {
    if (booking.equipmentId) {
      equipmentIdValue = booking.equipmentId.toString();
    } else {
      const metadataEquipmentId = readMetadataString(session?.metadata || {}, "equipmentId");
      if (metadataEquipmentId) equipmentIdValue = metadataEquipmentId;
    }
  } catch {
    equipmentIdValue = null;
  }

  if (equipmentIdValue && (!ObjectId.isValid(equipmentIdValue) || !/^[0-9a-fA-F]{24}$/.test(equipmentIdValue))) {
    logMetadataIssue("completePayment", session.id, "equipmentId(from booking)", equipmentIdValue);
  }

  try {
    if (equipmentIdValue && ObjectId.isValid(equipmentIdValue) && /^[0-9a-fA-F]{24}$/.test(equipmentIdValue)) {
      await db.collection(EQUIPMENT_COLLECTION).findOne({
        _id: toObjectId(equipmentIdValue, "equipment id"),
      });
    }
  } catch (error) {
    console.warn(
      `[stripe] completePayment: could not load equipment for session ${session.id} (equipmentId: ${equipmentIdValue || "missing"}): ${error?.message || error}`,
    );
  }

  const paymentSet = {
    bookingId: booking._id,
    customerId: customer?._id?.toString() || null,
    ownerId: owner?._id?.toString() || null,
    equipmentId: equipmentIdValue,
    customerEmail: booking.customer?.email || "",
    ownerEmail: booking.ownerEmail || "",
    amount,
    currency,
    stripeSessionId: session.id,
    paymentMethod,
    status: "paid",
    createdAt: now,
    paidAt: now,
    updatedAt: now,
  };
  if (transactionId) paymentSet.transactionId = transactionId;

  await db.collection(PAYMENTS_COLLECTION).updateOne(
    { stripeSessionId: session.id },
    { $set: paymentSet },
    { upsert: true },
  );

  await createNotification(
    db,
    booking.customer?.email || "",
    "payment_received",
    "Payment Received",
    `Your payment of ${amount.toFixed(2)} ${currency.toUpperCase()} for "${booking.equipmentName}" has been confirmed.`,
    "/dashboard/customer/my-rentals",
    { bookingId: booking._id.toString(), transactionId }
  );
  if (booking.ownerEmail) {
    await createNotification(
      db,
      booking.ownerEmail,
      "payment_received",
      "New Booking Payment",
      `You received a payment of ${amount.toFixed(2)} ${currency.toUpperCase()} for "${booking.equipmentName}".`,
      "/dashboard/owner/my-rentals",
      { bookingId: booking._id.toString(), transactionId }
    );
  }

  return finalBooking;
}

export async function verifyAndProcessStripeEvent(rawBody, signature) {
  if (!env.stripeWebhookSecret) {
    return { status: 503, body: { success: false, message: "Stripe webhook is not configured" } };
  }

  if (!signature) {
    return { status: 400, body: { success: false, message: "Missing Stripe signature" } };
  }

  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch {
    return { status: 400, body: { success: false, message: "Invalid webhook signature" } };
  }

  if (event.type === "checkout.session.completed") {
    await completePayment(event.data.object, stripe);
  }

  return { status: 200, body: { received: true } };
}

export async function stripeWebhook(req, res) {
  const result = await verifyAndProcessStripeEvent(
    req.body,
    req.headers["stripe-signature"],
  );

  res.status(result.status).json(result.body);
}

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

export async function verifyPayment(req, res) {
  const sessionId = (
    req.query?.session_id ||
    req.query?.sessionId ||
    req.params?.sessionId ||
    req.params?.session_id ||
    ""
  ).trim();

  const parsed = parseOrThrow(sessionIdSchema, { session_id: sessionId });
  const parsedSessionId = parsed.session_id;

  const db = await getDb();
  let booking = await db.collection(BOOKINGS_COLLECTION).findOne({ stripeSessionId: parsedSessionId });
  let session = null;

  const stripe = getStripe();

  if (!booking) {
    session = await retrieveSession(stripe, parsedSessionId);
    const metadata = session?.metadata || {};

    const bookingId = readMetadataString(metadata, "bookingId");
    const equipmentId = readMetadataString(metadata, "equipmentId");
    const startDate = readMetadataString(metadata, "startDate");
    const endDate = readMetadataString(metadata, "endDate");
    const customerEmail = readMetadataString(metadata, "customerEmail");

    if (!bookingId) logMetadataIssue("verifyPayment", parsedSessionId, "bookingId", metadata?.bookingId);
    if (!equipmentId) logMetadataIssue("verifyPayment", parsedSessionId, "equipmentId", metadata?.equipmentId);
    if (!startDate) logMetadataIssue("verifyPayment", parsedSessionId, "startDate", metadata?.startDate);
    if (!endDate) logMetadataIssue("verifyPayment", parsedSessionId, "endDate", metadata?.endDate);
    if (!customerEmail) logMetadataIssue("verifyPayment", parsedSessionId, "customerEmail", metadata?.customerEmail);

    if (bookingId && ObjectId.isValid(bookingId) && /^[0-9a-fA-F]{24}$/.test(bookingId)) {
      booking = await db
        .collection(BOOKINGS_COLLECTION)
        .findOne({ _id: toObjectId(bookingId, "booking id") });
    } else if (bookingId) {
      logMetadataIssue("verifyPayment", parsedSessionId, "bookingId", bookingId);
    }

    if (!booking) {
      booking = await db.collection(BOOKINGS_COLLECTION).findOne({ stripeSessionId: parsedSessionId });
    }
  }

  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking not found for this payment session" });
  }

  if (booking.customer?.email !== req.user.email) {
    return res.status(403).json({ success: false, message: "This booking belongs to another customer" });
  }

  if (booking.paymentStatus !== "paid") {
    session = session || (await retrieveSession(stripe, parsedSessionId));

    const metadata = session?.metadata || {};
    const metadataBookingId = readMetadataString(metadata, "bookingId");
    const metadataEquipmentId = readMetadataString(metadata, "equipmentId");
    const metadataStartDate = readMetadataString(metadata, "startDate");
    const metadataEndDate = readMetadataString(metadata, "endDate");
    const metadataCustomerEmail = readMetadataString(metadata, "customerEmail");

    if (!metadataBookingId) logMetadataIssue("verifyPayment", parsedSessionId, "bookingId", metadata?.bookingId);
    if (!metadataEquipmentId) logMetadataIssue("verifyPayment", parsedSessionId, "equipmentId", metadata?.equipmentId);
    if (!metadataStartDate) logMetadataIssue("verifyPayment", parsedSessionId, "startDate", metadata?.startDate);
    if (!metadataEndDate) logMetadataIssue("verifyPayment", parsedSessionId, "endDate", metadata?.endDate);
    if (!metadataCustomerEmail) logMetadataIssue("verifyPayment", parsedSessionId, "customerEmail", metadata?.customerEmail);

    if (metadataEquipmentId && !(ObjectId.isValid(metadataEquipmentId) && /^[0-9a-fA-F]{24}$/.test(metadataEquipmentId))) {
      logMetadataIssue("verifyPayment", parsedSessionId, "equipmentId", metadataEquipmentId);
    }

    if (session?.payment_status === "paid") {
      booking = (await completePayment(session, stripe)) || booking;
    }
  }

  const payment = await db.collection(PAYMENTS_COLLECTION).findOne({
    stripeSessionId: parsedSessionId,
  });

  const transactionId = payment?.transactionId || booking.transactionId || "";
  const amount = payment?.amount ?? booking.totalAmount ?? 0;
  const currency = payment?.currency || "usd";
  const paidAt = payment?.paidAt || booking.paidAt || null;

  return res.status(200).json({
    success: true,
    data: {
      booking: serializeBooking(booking),
      transactionId,
      amount,
      currency,
      paymentStatus: booking.paymentStatus,
      paidAt,
      equipmentName: booking.equipmentName || "",
      startDate: booking.startDate,
      endDate: booking.endDate,
      quantity: booking.quantity,
      bookingId: booking._id.toString(),
    },
  });
}
