import { getDb } from "../config/db.js";
import { AUTH_COOKIE_NAME, verifyAccessToken } from "../utils/token.js";
import { serializeUser } from "../utils/serialize.js";

function extractToken(req) {
  const header = req.headers.authorization;

  if (header && header.startsWith("Bearer ")) {
    return header.slice(7).trim() || null;
  }

  return req.cookies?.[AUTH_COOKIE_NAME] || null;
}

/**
 * Reads the JWT from the httpOnly cookie (or Bearer header fallback),
 * verifies it and loads fresh user data from MongoDB onto req.user.
 * The role always comes from the database, never from the token body.
 */
export async function verifyToken(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    if (!payload?.email) {
      return res.status(401).json({ success: false, message: "Invalid token payload" });
    }

    const db = await getDb();
    const user = await db
      .collection("users")
      .findOne({ email: String(payload.email).toLowerCase() });

    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists" });
    }

    req.user = serializeUser(user);
    return next();
  } catch (error) {
    return next(error);
  }
}
