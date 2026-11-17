import { ObjectId } from "mongodb";

/**
 * Converts a route :id param into an ObjectId, throwing a 400 error
 * for anything that is not a 24 character hexadecimal id.
 */
export function toObjectId(id, label = "id") {
  if (typeof id !== "string" || !/^[0-9a-fA-F]{24}$/.test(id)) {
    const error = new Error(`Invalid ${label}`);
    error.status = 400;
    throw error;
  }

  return new ObjectId(id);
}
