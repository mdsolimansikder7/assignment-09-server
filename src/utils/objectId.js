import { ObjectId } from "mongodb";

export function toObjectId(id, label = "id") {
  if (id instanceof ObjectId) return id;

  if (typeof id === "string" && ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
    return new ObjectId(id);
  }

  const error = new Error(`Invalid ${label}`);
  error.status = 400;
  throw error;
}
