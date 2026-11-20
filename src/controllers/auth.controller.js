import { z } from "zod";
import { getDb } from "../config/db.js";
import { parseOrThrow } from "../utils/validate.js";
import { clearAuthCookie, setAuthCookie, signAccessToken } from "../utils/token.js";
import { serializeUser } from "../utils/serialize.js";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.unknown().optional(),
});

function nameFromEmail(email) {
  const local = email.split("@")[0] || "";
  const words = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

  if (!words) return "Customer";

  return words.replace(/\b\w/g, (character) => character.toUpperCase());
}

export async function loginWithJwt(req, res) {
  const { email, role } = parseOrThrow(loginSchema, req.body ?? {});
  const db = await getDb();
  const users = db.collection("users");
  const now = new Date();

  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : "";
  const assignedRole = normalizedRole === "owner" ? "owner" : "customer";

  const update = {
    $setOnInsert: {
      name: nameFromEmail(email),
      photo: "",
      phone: "",
      address: "",
      role: assignedRole,
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
    token,
    data: serializeUser(user),
  });
}

export async function logout(req, res) {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: "Logged out" });
}
