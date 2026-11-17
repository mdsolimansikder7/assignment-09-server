import { z } from "zod";
import { getDb } from "../config/db.js";
import { parseOrThrow } from "../utils/validate.js";
import { clearAuthCookie, setAuthCookie, signAccessToken } from "../utils/token.js";
import { serializeUser } from "../utils/serialize.js";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

/**
 * Builds a human friendly display name from the email local part,
 * e.g. "john.doe@mail.com" -> "John Doe".
 */
function nameFromEmail(email) {
  const local = email.split("@")[0] || "";
  const words = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

  if (!words) return "Customer";

  return words.replace(/\b\w/g, (character) => character.toUpperCase());
}

export async function loginWithJwt(req, res) {
  const { email } = parseOrThrow(loginSchema, req.body ?? {});
  const db = await getDb();
  const users = db.collection("users");
  const now = new Date();

  const update = {
    $setOnInsert: {
      name: nameFromEmail(email),
      photo: "",
      phone: "",
      address: "",
      role: "customer",
      createdAt: now,
    },
    $set: { updatedAt: now },
  };

  let user;
  try {
    user = await users.findOneAndUpdate({ email }, update, {
      upsert: true,
      returnDocument: "after",
    });
  } catch (error) {
    // Two simultaneous first-time logins can race on the unique email index.
    if (error.code === 11000) {
      user = await users.findOne({ email });
    } else {
      throw error;
    }
  }

  if (!user) {
    const error = new Error("Could not create the user account");
    error.status = 500;
    throw error;
  }

  const token = signAccessToken(email);
  setAuthCookie(res, token);

  res.status(200).json({
    success: true,
    token, // Bearer fallback for clients that cannot use cookies
    data: serializeUser(user),
  });
}

export async function logout(req, res) {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: "Logged out" });
}
