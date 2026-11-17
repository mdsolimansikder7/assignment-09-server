import { z } from "zod";
import { getDb } from "../config/db.js";
import { toObjectId } from "../utils/objectId.js";
import { parseOrThrow } from "../utils/validate.js";
import { serializeEquipment } from "../utils/serialize.js";
import { escapeRegex } from "../utils/regex.js";

const EQUIPMENT_COLLECTION = "equipment";

// Client supplied status, owner and timestamps are never trusted.
const equipmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(3000),
  category: z.string().trim().min(2).max(60),
  location: z.string().trim().min(2).max(120),
  rentalPrice: z.coerce.number().positive().max(1_000_000),
  rentalType: z.enum(["daily", "weekly", "monthly"]),
  availableQuantity: z.coerce.number().int().min(0).max(10_000),
  condition: z.string().trim().max(60).optional(),
  brand: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  image: z.string().trim().max(2000).optional(),
  terms: z.string().trim().max(2000).optional(),
});

const equipmentUpdateSchema = equipmentSchema.partial();

// Query params for the public listing. All filtering happens in MongoDB.
const listQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().max(60).optional(),
    rentalType: z.enum(["daily", "weekly", "monthly"]).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    availability: z.enum(["available"]).optional(),
    sort: z.enum(["price_asc", "price_desc", "newest"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(9),
  })
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      query.minPrice <= query.maxPrice,
    { message: "minPrice cannot be greater than maxPrice", path: ["minPrice"] },
  );

const SORT_OPTIONS = {
  price_asc: { rentalPrice: 1 },
  price_desc: { rentalPrice: -1 },
  newest: { createdAt: -1 },
};

// Empty query params ("?category=") are treated as absent.
function cleanQuery(query) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function buildEquipmentFilter(query) {
  const filter = { status: "approved" };

  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ name: regex }, { category: regex }, { location: regex }];
  }

  if (query.category) {
    filter.category = new RegExp(`^${escapeRegex(query.category)}$`, "i");
  }

  if (query.rentalType) {
    filter.rentalType = query.rentalType;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.rentalPrice = {};
    if (query.minPrice !== undefined) filter.rentalPrice.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.rentalPrice.$lte = query.maxPrice;
  }

  if (query.availability === "available") {
    filter.availableQuantity = { $gt: 0 };
  }

  return filter;
}

function ownerSnapshot(user) {
  return {
    name: user.name,
    email: user.email,
    photo: user.photo || "",
  };
}

export async function createEquipment(req, res) {
  const data = parseOrThrow(equipmentSchema, req.body ?? {});
  const now = new Date();
  const db = await getDb();

  const document = {
    ...data,
    status: "pending", // every new listing waits for admin approval
    owner: ownerSnapshot(req.user),
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(EQUIPMENT_COLLECTION).insertOne(document);

  res.status(201).json({
    success: true,
    data: serializeEquipment({ ...document, _id: result.insertedId }),
  });
}

export async function listEquipment(req, res) {
  const query = parseOrThrow(listQuerySchema, cleanQuery(req.query ?? {}));
  const { page, limit } = query;

  const db = await getDb();
  const collection = db.collection(EQUIPMENT_COLLECTION);
  const filter = buildEquipmentFilter(query);
  const sort = SORT_OPTIONS[query.sort] || SORT_OPTIONS.newest;

  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: items.map(serializeEquipment),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function listFeaturedEquipment(req, res) {
  const db = await getDb();
  const items = await db
    .collection(EQUIPMENT_COLLECTION)
    .find({ status: "approved" })
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();

  res.status(200).json({ success: true, data: items.map(serializeEquipment) });
}

export async function listCategories(req, res) {
  const db = await getDb();
  const categories = await db
    .collection(EQUIPMENT_COLLECTION)
    .distinct("category", { status: "approved" });

  res.status(200).json({
    success: true,
    data: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)),
  });
}

export async function getEquipmentById(req, res) {
  const db = await getDb();
  const item = await db
    .collection(EQUIPMENT_COLLECTION)
    .findOne({ _id: toObjectId(req.params.id, "equipment id") });

  if (!item) {
    return res.status(404).json({ success: false, message: "Equipment not found" });
  }

  // Unapproved listings are only visible to their owner and to admins.
  const isOwner = item.owner?.email === req.user.email;
  const isAdmin = req.user.role === "admin";
  if (item.status !== "approved" && !isOwner && !isAdmin) {
    return res.status(404).json({ success: false, message: "Equipment not found" });
  }

  return res.status(200).json({ success: true, data: serializeEquipment(item) });
}

export async function listMyEquipment(req, res) {
  const db = await getDb();
  const items = await db
    .collection(EQUIPMENT_COLLECTION)
    .find({ "owner.email": req.user.email })
    .sort({ createdAt: -1 })
    .toArray();

  res.status(200).json({
    success: true,
    total: items.length,
    data: items.map(serializeEquipment),
  });
}

export async function updateEquipment(req, res) {
  const id = toObjectId(req.params.id, "equipment id");
  const updates = parseOrThrow(equipmentUpdateSchema, req.body ?? {});

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: "No valid fields to update" });
  }

  const db = await getDb();
  const collection = db.collection(EQUIPMENT_COLLECTION);
  const existing = await collection.findOne({ _id: id });

  if (!existing) {
    return res.status(404).json({ success: false, message: "Equipment not found" });
  }

  if (req.user.role !== "admin" && existing.owner?.email !== req.user.email) {
    return res.status(403).json({
      success: false,
      message: "You can only update your own equipment",
    });
  }

  const update = { ...updates, updatedAt: new Date() };

  // Keep the owner snapshot in sync with the profile that owns the listing.
  if (req.user.role !== "admin") {
    update.owner = ownerSnapshot(req.user);
  }

  const item = await collection.findOneAndUpdate(
    { _id: id },
    { $set: update },
    { returnDocument: "after" },
  );

  return res.status(200).json({ success: true, data: serializeEquipment(item) });
}

export async function deleteEquipment(req, res) {
  const id = toObjectId(req.params.id, "equipment id");
  const db = await getDb();
  const collection = db.collection(EQUIPMENT_COLLECTION);
  const existing = await collection.findOne({ _id: id });

  if (!existing) {
    return res.status(404).json({ success: false, message: "Equipment not found" });
  }

  if (req.user.role !== "admin" && existing.owner?.email !== req.user.email) {
    return res.status(403).json({
      success: false,
      message: "You can only delete your own equipment",
    });
  }

  await collection.deleteOne({ _id: id });

  return res.status(200).json({ success: true, message: "Equipment deleted" });
}
