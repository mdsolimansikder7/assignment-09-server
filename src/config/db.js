import { MongoClient } from "mongodb";
import { env } from "./env.js";

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
