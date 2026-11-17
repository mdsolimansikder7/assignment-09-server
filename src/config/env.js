import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || "",
  dbName: process.env.DB_NAME || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  nodeEnv,
  isProduction: nodeEnv === "production",
  emailUser: process.env.EMAIL_USER || "",
  emailPass: process.env.EMAIL_PASS || "",
  // Local origins are only trusted outside production.
  allowedOrigins: [
    process.env.CLIENT_URL || "http://localhost:3000",
    ...(nodeEnv === "production"
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000"]),
  ],
};

/**
 * Logs missing configuration without printing any secret value.
 * The server still starts so that cold starts never crash; the
 * affected features simply fail with a clear error at request time.
 */
export function warnMissingEnv() {
  const required = ["MONGODB_URI", "JWT_SECRET"];
  if (env.isProduction) required.push("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET");

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`[env] Missing environment variables: ${missing.join(", ")}`);
  }
}
