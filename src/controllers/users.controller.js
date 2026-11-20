import { z } from "zod";
import { getDb } from "../config/db.js";
import { toObjectId } from "../utils/objectId.js";
import { parseOrThrow } from "../utils/validate.js";
import { serializeUser } from "../utils/serialize.js";

const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  photo: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(["customer", "owner", "admin"]),
});

export async function getMe(req, res) {
  res.status(200).json({ success: true, data: req.user });
}

export async function updateMe(req, res) {
  const updates = parseOrThrow(updateMeSchema, req.body ?? {});

  if (updates.photo === "") {
    delete updates.photo;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one of: name, photo, phone, address",
    });
  }

  const db = await getDb();
  const user = await db.collection("users").findOneAndUpdate(
    { _id: toObjectId(req.user.id) },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  return res.status(200).json({ success: true, data: serializeUser(user) });
}

export async function listUsers(req, res) {
  const db = await getDb();
  const users = await db
    .collection("users")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  res.status(200).json({
    success: true,
    total: users.length,
    data: users.map(serializeUser),
  });
}

export async function updateUserRole(req, res) {
  const { role } = parseOrThrow(updateRoleSchema, req.body ?? {});
  const db = await getDb();
  const users = db.collection("users");
  const targetId = toObjectId(req.params.id, "user id");
  const target = await users.findOne({ _id: targetId });

  if (!target) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (target.email === req.user.email) {
    return res.status(403).json({
      success: false,
      message: "You cannot change your own role",
    });
  }

  if (target.role === "admin" && role !== "admin") {
    const adminCount = await users.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return res.status(403).json({
        success: false,
        message: "Cannot demote the last remaining admin",
      });
    }
  }

  const user = await users.findOneAndUpdate(
    { _id: targetId },
    { $set: { role, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  return res.status(200).json({ success: true, data: serializeUser(user) });
}

export async function deleteUser(req, res) {
  const db = await getDb();
  const users = db.collection("users");
  const targetId = toObjectId(req.params.id, "user id");
  const target = await users.findOne({ _id: targetId });

  if (!target) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (target.email === req.user.email) {
    return res.status(403).json({
      success: false,
      message: "You cannot delete your own account",
    });
  }

  if (target.role === "admin") {
    const adminCount = await users.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete the last remaining admin",
      });
    }
  }

  await users.deleteOne({ _id: targetId });

  return res.status(200).json({
    success: true,
    message: "User deleted",
    data: serializeUser(target),
  });
}
