import { MongoClient } from "mongodb";
import { env } from "./env.js";

// Cache the client promise at module scope. Serverless platforms such as
// Vercel reuse warm instances, so caching avoids opening a new connection
// (and the resulting 504 timeout) on every request.
let clientPromise = null;

export function getClient() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!clientPromise) {
    const client = new MongoClient(env.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });

    clientPromise = client.connect().catch((error) => {
      // Reset the cache so the next request can retry instead of
      // reusing a rejected promise forever.
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}

export async function getDb() {
  const client = await getClient();
  return env.dbName ? client.db(env.dbName) : client.db();
}

export async function connectDb() {
  const client = await getClient();
  return env.dbName ? client.db(env.dbName) : client.db();
}
