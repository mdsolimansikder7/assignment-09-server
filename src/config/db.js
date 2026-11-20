import { MongoClient } from "mongodb";
import { env } from "./env.js";

let client;
let clientPromise;

function resetClient() {
  client = undefined;
  clientPromise = undefined;
}

export function getClient() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (clientPromise) {
    return clientPromise;
  }

  client = new MongoClient(env.mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });

  // If the MongoDB connection closes later, clear cache so future requests reconnect.
  client.on("close", resetClient);

  clientPromise = client.connect().catch((error) => {
    resetClient();
    throw error;
  });

  return clientPromise;
}

export async function getDb() {
  const connectedClient = await getClient();
  return env.dbName ? connectedClient.db(env.dbName) : connectedClient.db();
}

export async function connectDb() {
  const connectedClient = await getClient();
  return env.dbName ? connectedClient.db(env.dbName) : connectedClient.db();
}
