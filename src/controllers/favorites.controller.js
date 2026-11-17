import { z } from "zod";
import { getDb } from "../config/db.js";
import { toObjectId } from "../utils/objectId.js";
import { parseOrThrow } from "../utils/validate.js";
import { serializeEquipment, serializeFavorite } from "../utils/serialize.js";

const FAVORITES_COLLECTION = "favorites";
const EQUIPMENT_COLLECTION = "equipment";

const addFavoriteSchema = z.object({
  equipmentId: z.string().trim().min(1),
});

export async function addFavorite(req, res) {
  const { equipmentId } = parseOrThrow(addFavoriteSchema, req.body ?? {});
  const equipmentObjectId = toObjectId(equipmentId, "equipment id");

  const db = await getDb();
  const equipment = await db
    .collection(EQUIPMENT_COLLECTION)
    .findOne({ _id: equipmentObjectId }, { projection: { _id: 1 } });

  if (!equipment) {
    return res.status(404).json({ success: false, message: "Equipment not found" });
  }

  const favorite = { userEmail: req.user.email, equipmentId: equipmentObjectId, createdAt: new Date() };

  try {
    const result = await db.collection(FAVORITES_COLLECTION).insertOne(favorite);
    return res.status(201).json({
      success: true,
      data: serializeFavorite({ ...favorite, _id: result.insertedId }),
    });
  } catch (error) {
    // Unique index on (userEmail, equipmentId) guards against duplicates.
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Equipment already in favorites" });
    }
    throw error;
  }
}

export async function listFavorites(req, res) {
  const db = await getDb();

  const favorites = await db
    .collection(FAVORITES_COLLECTION)
    .aggregate([
      { $match: { userEmail: req.user.email } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: EQUIPMENT_COLLECTION,
          localField: "equipmentId",
          foreignField: "_id",
          as: "equipment",
        },
      },
      // Skip favorites whose equipment was deleted.
      { $unwind: "$equipment" },
    ])
    .toArray();

  res.status(200).json({
    success: true,
    total: favorites.length,
    data: favorites.map((favorite) => ({
      ...serializeFavorite(favorite),
      equipment: serializeEquipment(favorite.equipment),
    })),
  });
}

export async function removeFavorite(req, res) {
  const equipmentObjectId = toObjectId(req.params.equipmentId, "equipment id");
  const db = await getDb();

  const result = await db.collection(FAVORITES_COLLECTION).deleteOne({
    userEmail: req.user.email,
    equipmentId: equipmentObjectId,
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, message: "Favorite not found" });
  }

  return res.status(200).json({ success: true, message: "Favorite removed" });
}
