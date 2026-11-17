/**
 * Creates the indexes the API relies on. Called once after the
 * database connection is established.
 */
export async function ensureIndexes(db) {
  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  await db.collection("equipment").createIndex({ status: 1 });
  await db.collection("equipment").createIndex({ category: 1 });
  await db.collection("equipment").createIndex({ "owner.email": 1 });
}
