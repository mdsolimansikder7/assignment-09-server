import { z } from "zod";
import { getDb } from "../config/db.js";
import { toObjectId } from "../utils/objectId.js";
import { parseOrThrow } from "../utils/validate.js";
import { serializeBooking } from "../utils/serialize.js";
import { getAvailableQuantity } from "../services/availability.js";
import { calculateTotal, daysBetween } from "../services/pricing.js";
import { getStripe } from "../config/stripe.js";
import { env } from "../config/env.js";

const BOOKINGS_COLLECTION = "bookings";
const EQUIPMENT_COLLECTION = "equipment";

const checkoutSchema = z
  .object({
    equipmentId: z.string().trim().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    quantity: z.coerce.number().int().positive().max(1000),
    deliveryAddress: z.string().trim().min(5).max(300),
    phone: z.string().trim().min(6).max(30).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    message: "endDate cannot be earlier than startDate",
    path: ["endDate"],
  });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(9),
});

const adminUpdateSchema = z.object({
  bookingStatus: z.enum(["pending", "confirmed", "active", "completed", "cancelled"]),
});

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export async function checkout(req, res) {
  const data = parseOrThrow(checkoutSchema, req.body ?? {});

  if (data.startDate.getTime() < startOfToday().getTime()) {
    return res.status(400).json({ success: false, message: "startDate cannot be in the past" });
  }

  // Fails with 503 before a booking is created when Stripe is not configured.
  const stripe = getStripe();

  const db = await getDb();
  const equipment = await db
    .collection(EQUIPMENT_COLLECTION)
    .findOne({ _id: toObjectId(data.equipmentId, "equipment id") });

  if (!equipment || equipment.status !== "approved") {
    return res.status(404).json({ success: false, message: "Equipment not available for booking" });
  }

  const available = await getAvailableQuantity(db, equipment, data.startDate, data.endDate);

  if (data.quantity > available) {
    return res.status(409).json({
      success: false,
      message: `Only ${available} unit(s) available for the selected dates`,
    });
  }

  const days = daysBetween(data.startDate, data.endDate);
  const totalAmount = calculateTotal({
    rentalType: equipment.rentalType,
    rentalPrice: equipment.rentalPrice,
    days,
    quantity: data.quantity,
  });

  const booking = {
    equipmentId: equipment._id,
    equipmentName: equipment.name,
    customer: {
      name: req.user.name,
      email: req.user.email,
      phone: data.phone || req.user.phone || "",
    },
    ownerEmail: equipment.owner?.email || "",
    startDate: data.startDate,
    endDate: data.endDate,
    quantity: data.quantity,
    totalAmount,
    deliveryAddress: data.deliveryAddress,
    notes: data.notes || "",
    paymentStatus: "unpaid",
    bookingStatus: "pending",
    stripeSessionId: null,
    createdAt: new Date(),
  };

  const result = await db.collection(BOOKINGS_COLLECTION).insertOne(booking);
  const bookingId = result.insertedId;

  // Stripe Checkout session. Prices come from the server-computed total.
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: req.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(totalAmount * 100),
            product_data: {
              name: `${equipment.name} (${days} day${days === 1 ? "" : "s"}, ${equipment.rentalType})`,
            },
          },
        },
      ],
      metadata: {
        bookingId: bookingId.toString(),
        equipmentId: equipment._id.toString(),
      },
      success_url: `${env.clientUrl}/bookings/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.clientUrl}/equipment/${equipment._id.toString()}?payment=cancelled`,
    });
  } catch (error) {
    // Do not leave an orphan pending booking behind.
    await db.collection(BOOKINGS_COLLECTION).deleteOne({ _id: bookingId });
    console.error(`[stripe] Checkout session creation failed: ${error.message}`);

    const failure = new Error("Could not initialize payment");
    failure.status = 502;
    throw failure;
  }

  await db
    .collection(BOOKINGS_COLLECTION)
    .updateOne({ _id: bookingId }, { $set: { stripeSessionId: session.id, updatedAt: new Date() } });

  res.status(201).json({
    success: true,
    data: serializeBooking({ ...booking, _id: bookingId, stripeSessionId: session.id }),
    url: session.url,
    sessionId: session.id,
  });
}

export async function listMyBookings(req, res) {
  const { page, limit } = parseOrThrow(listQuerySchema, req.query ?? {});
  const db = await getDb();
  const filter = { "customer.email": req.user.email };

  const [items, total] = await Promise.all([
    db
      .collection(BOOKINGS_COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection(BOOKINGS_COLLECTION).countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: items.map(serializeBooking),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function listOwnerBookings(req, res) {
  const { page, limit } = parseOrThrow(listQuerySchema, req.query ?? {});
  const db = await getDb();
  const filter = { ownerEmail: req.user.email };

  const [items, total] = await Promise.all([
    db
      .collection(BOOKINGS_COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection(BOOKINGS_COLLECTION).countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: items.map(serializeBooking),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function listAllBookings(req, res) {
  const { page, limit } = parseOrThrow(listQuerySchema, req.query ?? {});
  const db = await getDb();
  const filter = {};

  const [items, total] = await Promise.all([
    db
      .collection(BOOKINGS_COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection(BOOKINGS_COLLECTION).countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: items.map(serializeBooking),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function updateBookingStatus(req, res) {
  const { bookingStatus } = parseOrThrow(adminUpdateSchema, req.body ?? {});
  const db = await getDb();

  const booking = await db.collection(BOOKINGS_COLLECTION).findOneAndUpdate(
    { _id: toObjectId(req.params.id, "booking id") },
    { $set: { bookingStatus, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }

  return res.status(200).json({ success: true, data: serializeBooking(booking) });
}
