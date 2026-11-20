import { z } from "zod";
import { getDb } from "../config/db.js";
import { toObjectId } from "../utils/objectId.js";
import { parseOrThrow } from "../utils/validate.js";
import { serializeReview } from "../utils/serialize.js";

const REVIEWS_COLLECTION = "reviews";
const EQUIPMENT_COLLECTION = "equipment";
const BOOKINGS_COLLECTION = "bookings";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const reviewBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z
    .string()
    .transform((v) => (typeof v === "string" ? v.trim() : v))
    .pipe(z.string().min(3).max(500)),
});

function sanitizeComment(comment) {
  return String(comment ?? "")
    .replace(/[<>]/g, "")
    .trim();
}

async function findEquipmentOr404(db, equipmentIdParam, res) {
  let equipmentId;
  try {
    equipmentId = toObjectId(equipmentIdParam, "equipment id");
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message || "Invalid equipment id" });
    return null;
  }

  const equipment = await db.collection(EQUIPMENT_COLLECTION).findOne({ _id: equipmentId });
  if (!equipment) {
    res.status(404).json({ success: false, message: "Equipment not found" });
    return null;
  }
  return equipment;
}

async function recomputeEquipmentRating(db, equipmentId) {
  const [stats] = await db
    .collection(REVIEWS_COLLECTION)
    .aggregate([
      { $match: { equipmentId } },
      {
        $group: {
          _id: "$equipmentId",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const reviewCount = stats?.reviewCount || 0;
  const averageRating = reviewCount > 0 ? Number(Number(stats.averageRating).toFixed(1)) : 0;

  await db.collection(EQUIPMENT_COLLECTION).updateOne(
    { _id: equipmentId },
    { $set: { averageRating, reviewCount, updatedAt: new Date() } },
  );

  return { averageRating, reviewCount };
}

export async function listEquipmentReviews(req, res) {
  const db = await getDb();
  const equipment = await findEquipmentOr404(db, req.params.id, res);
  if (!equipment) return;

  const query = parseOrThrow(listQuerySchema, req.query ?? {});
  const page = query.page;
  const limit = query.limit;
  const filter = { equipmentId: equipment._id };

  const [items, total, stats] = await Promise.all([
    db
      .collection(REVIEWS_COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection(REVIEWS_COLLECTION).countDocuments(filter),
    db
      .collection(REVIEWS_COLLECTION)
      .aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$equipmentId",
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  const totalReviews = stats?.[0]?.totalReviews || 0;
  const averageRating = totalReviews > 0 ? Number(Number(stats[0].averageRating).toFixed(1)) : 0;

  return res.status(200).json({
    success: true,
    reviews: items.map(serializeReview),
    averageRating,
    totalReviews,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function canReviewEquipment(req, res) {
  const db = await getDb();
  const equipment = await findEquipmentOr404(db, req.params.id, res);
  if (!equipment) return;

  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const userEmail = req.user.email;
  const existing = await db.collection(REVIEWS_COLLECTION).findOne({
    equipmentId: equipment._id,
    userEmail,
  });

  const myReview = existing ? serializeReview(existing) : null;

  if (req.user.role !== "customer") {
    return res.status(200).json({
      success: true,
      canReview: false,
      reason: "Only customers can write reviews.",
      myReview,
    });
  }

  if (equipment.owner?.email === userEmail) {
    return res.status(200).json({
      success: true,
      canReview: false,
      reason: "You cannot review your own equipment.",
      myReview,
    });
  }

  if (existing) {
    return res.status(200).json({
      success: true,
      canReview: false,
      reason: "You have already reviewed this equipment.",
      myReview,
    });
  }

  const completedBooking = await db.collection(BOOKINGS_COLLECTION).findOne({
    equipmentId: equipment._id,
    "customer.email": userEmail,
    bookingStatus: "completed",
  });

  if (!completedBooking) {
    return res.status(200).json({
      success: true,
      canReview: false,
      reason: "You can review this equipment after completing a rental.",
      myReview: null,
    });
  }

  return res.status(200).json({
    success: true,
    canReview: true,
    reason: "",
    myReview: null,
  });
}

export async function createEquipmentReview(req, res) {
  const db = await getDb();
  const equipment = await findEquipmentOr404(db, req.params.id, res);
  if (!equipment) return;

  if (equipment.owner?.email === req.user.email) {
    return res.status(403).json({
      success: false,
      message: "You cannot review your own equipment",
    });
  }

  const body = parseOrThrow(reviewBodySchema, req.body ?? {});
  const comment = sanitizeComment(body.comment);
  if (comment.length < 3) {
    return res.status(400).json({ success: false, message: "Comment must be at least 3 characters" });
  }
  if (comment.length > 500) {
    return res.status(400).json({ success: false, message: "Comment must be 500 characters or less" });
  }

  const existing = await db.collection(REVIEWS_COLLECTION).findOne({
    equipmentId: equipment._id,
    userEmail: req.user.email,
  });
  if (existing) {
    return res.status(409).json({ success: false, message: "You have already reviewed this equipment" });
  }

  const completedBooking = await db.collection(BOOKINGS_COLLECTION).findOne({
    equipmentId: equipment._id,
    "customer.email": req.user.email,
    bookingStatus: "completed",
  });

  if (!completedBooking) {
    return res.status(403).json({
      success: false,
      message: "You can review this equipment after completing a rental",
    });
  }

  const now = new Date();
  const review = {
    equipmentId: equipment._id,
    bookingId: completedBooking._id,
    userEmail: req.user.email,
    userName: req.user.name || "Customer",
    userAvatar: req.user.photo || "",
    rating: body.rating,
    comment,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await db.collection(REVIEWS_COLLECTION).insertOne(review);
    await recomputeEquipmentRating(db, equipment._id);
    return res.status(201).json({
      success: true,
      data: serializeReview({ ...review, _id: result.insertedId }),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "You have already reviewed this equipment" });
    }
    throw error;
  }
}

export async function updateReview(req, res) {
  let reviewId;
  try {
    reviewId = toObjectId(req.params.reviewId, "review id");
  } catch (error) {
    return res.status(error.status || 400).json({ success: false, message: error.message || "Invalid review id" });
  }

  const body = parseOrThrow(reviewBodySchema, req.body ?? {});
  const comment = sanitizeComment(body.comment);
  if (comment.length < 3) {
    return res.status(400).json({ success: false, message: "Comment must be at least 3 characters" });
  }
  if (comment.length > 500) {
    return res.status(400).json({ success: false, message: "Comment must be 500 characters or less" });
  }

  const db = await getDb();
  const existing = await db.collection(REVIEWS_COLLECTION).findOne({ _id: reviewId });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  if (existing.userEmail !== req.user.email) {
    return res.status(403).json({ success: false, message: "You can only edit your own review" });
  }

  const updated = await db.collection(REVIEWS_COLLECTION).findOneAndUpdate(
    { _id: reviewId },
    {
      $set: {
        rating: body.rating,
        comment,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (updated) {
    await recomputeEquipmentRating(db, updated.equipmentId);
  }

  return res.status(200).json({ success: true, data: serializeReview(updated) });
}

export async function deleteReview(req, res) {
  let reviewId;
  try {
    reviewId = toObjectId(req.params.reviewId, "review id");
  } catch (error) {
    return res.status(error.status || 400).json({ success: false, message: error.message || "Invalid review id" });
  }

  const db = await getDb();
  const existing = await db.collection(REVIEWS_COLLECTION).findOne({ _id: reviewId });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  const isAuthor = existing.userEmail === req.user.email;
  const isAdmin = req.user.role === "admin";
  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ success: false, message: "You can only delete your own review" });
  }

  await db.collection(REVIEWS_COLLECTION).deleteOne({ _id: reviewId });
  await recomputeEquipmentRating(db, existing.equipmentId);

  return res.status(200).json({ success: true, message: "Review deleted" });
}
