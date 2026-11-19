import { getDb } from "../config/db.js";
import { toObjectId } from "../utils/objectId.js";
import { parseOrThrow } from "../utils/validate.js";
import { z } from "zod";

const NOTIFICATIONS_COLLECTION = "notifications";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().optional(),
});

export async function listNotifications(req, res) {
  const { page, limit, unreadOnly } = parseOrThrow(listQuerySchema, req.query ?? {});
  const db = await getDb();
  const filter = { userEmail: req.user.email };
  if (unreadOnly) filter.read = false;

  const [items, total] = await Promise.all([
    db
      .collection(NOTIFICATIONS_COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection(NOTIFICATIONS_COLLECTION).countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: items.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      link: n.link || null,
      metadata: n.metadata || {},
      createdAt: n.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function markAllRead(req, res) {
  const db = await getDb();
  await db.collection(NOTIFICATIONS_COLLECTION).updateMany(
    { userEmail: req.user.email, read: false },
    { $set: { read: true, updatedAt: new Date() } }
  );
  res.status(200).json({ success: true, message: "All notifications marked as read" });
}

export async function markOneRead(req, res) {
  const db = await getDb();
  const id = req.params.id;
  const notification = await db.collection(NOTIFICATIONS_COLLECTION).findOneAndUpdate(
    { _id: toObjectId(id, "notification id"), userEmail: req.user.email },
    { $set: { read: true, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found" });
  }
  res.status(200).json({ success: true });
}

export async function createNotification(db, userEmail, type, title, message, link = null, metadata = {}) {
  await db.collection(NOTIFICATIONS_COLLECTION).insertOne({
    userEmail,
    type,
    title,
    message,
    read: false,
    link,
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}