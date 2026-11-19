import { ObjectId } from "mongodb";

export function toObjectId(id, label = "id") {
  if (typeof id !== "string" || !/^[0-9a-fA-F]{24}$/.test(id)) {
    const error = new Error(`Invalid ${label}`);
    error.status = 400;
    throw error;
  }

  return new ObjectId(id);
}
