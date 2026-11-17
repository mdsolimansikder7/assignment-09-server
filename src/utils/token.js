import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const AUTH_COOKIE_NAME = "accessToken";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches the default JWT_EXPIRES_IN

export function signAccessToken(email) {
  if (!env.jwtSecret) {
    const error = new Error("JWT_SECRET is not configured");
    error.status = 500;
    throw error;
  }

  return jwt.sign({ email }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

/**
 * Production cookies are cross-site (client and server on different
 * domains), so they must be secure and sameSite "none". Locally the
 * client is on localhost over http, which requires sameSite "lax".
 */
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    path: "/",
  };
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, baseCookieOptions());
}
