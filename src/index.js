import app from "./app.js";
import { env, warnMissingEnv } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { ensureIndexes } from "./config/indexes.js";

async function start() {
  warnMissingEnv();

  // Connect before listening but never crash: if MongoDB is unreachable the
  // HTTP server still starts and individual requests fail cleanly instead of
  // the whole deployment going down on a cold start.
  try {
    const db = await connectDb();
    console.log("[db] MongoDB connected");

    try {
      await ensureIndexes(db);
      console.log("[db] Indexes ready");
    } catch (error) {
      console.error(`[db] Index creation failed: ${error.message}`);
    }
  } catch (error) {
    console.error(`[db] MongoDB connection failed: ${error.message}`);
  }

  const server = app.listen(env.port, () => {
    console.log(`[server] API listening on port ${env.port} (${env.nodeEnv})`);
  });

  server.on("error", (error) => {
    console.error(`[server] Failed to listen on port ${env.port}: ${error.message}`);
  });
}

// A stray rejection should never take the API down; log it instead.
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(`[process] Unhandled rejection: ${message}`);
});

process.on("uncaughtException", (error) => {
  console.error(`[process] Uncaught exception: ${error.message}`);
});

start();
