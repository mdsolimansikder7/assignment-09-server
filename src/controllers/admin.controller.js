import { z } from "zod";
import { getDb } from "../config/db.js";
import { toObjectId } from "../utils/objectId.js";
import { parseOrThrow } from "../utils/validate.js";
import { serializeEquipment } from "../utils/serialize.js";

const EQUIPMENT_COLLECTION = "equipment";

const statusSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export async function listAllEquipment(req, res) {
  const db = await getDb();
  const filter = {};

  if (req.query.status) {
    const result = z.enum(["pending", "approved", "rejected"]).safeParse(req.query.status);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "status must be one of: pending, approved, rejected",
      });
    }
    filter.status = result.data;
  }

  const items = await db
    .collection(EQUIPMENT_COLLECTION)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  res.status(200).json({
    success: true,
    total: items.length,
    data: items.map(serializeEquipment),
  });
}

export async function updateEquipmentStatus(req, res) {
  const { status } = parseOrThrow(statusSchema, req.body ?? {});
  const db = await getDb();

  const item = await db.collection(EQUIPMENT_COLLECTION).findOneAndUpdate(
    { _id: toObjectId(req.params.id, "equipment id") },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!item) {
    return res.status(404).json({ success: false, message: "Equipment not found" });
  }

  return res.status(200).json({
    success: true,
    message: `Equipment ${status}`,
    data: serializeEquipment(item),
  });
}
