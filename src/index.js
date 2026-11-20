import app from "./app.js";
import { env, warnMissingEnv } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { ensureIndexes } from "./config/indexes.js";
import { startJobs } from "./jobs/index.js";

async function start() {
  warnMissingEnv();

  let db;
  try {
    db = await connectDb();
    console.log("[db] MongoDB connected");
  } catch (error) {
    console.error(`[db] MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }

  try {
    await ensureIndexes(db);
  } catch {
  }

  const server = app.listen(env.port, () => {
    console.log(`[server] API listening on port ${env.port} (${env.nodeEnv})`);
  });

  server.on("error", (error) => {
    console.error(`[server] Failed to listen on port ${env.port}: ${error.message}`);
    process.exit(1);
  });

  startJobs();
}

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(`[process] Unhandled rejection: ${message}`);
});

process.on("uncaughtException", (error) => {
  console.error(`[process] Uncaught exception: ${error.message}`);
  process.exit(1);
});

start();