import app from "./app.js";
import { env, warnMissingEnv } from "./config/env.js";
import { connectDb } from "./config/db.js";

async function start() {
  warnMissingEnv();

  // Connect before listening but never crash: if MongoDB is unreachable the
  // HTTP server still starts and individual requests fail cleanly instead of
  // the whole deployment going down on a cold start.
  try {
    await connectDb();
    console.log("[db] MongoDB connected");
  } catch (error) {
    console.error(`[db] MongoDB connection failed: ${error.message}`);
  }

  app.listen(env.port, () => {
    console.log(`[server] API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start();
