import { getDb } from "../config/db.js";
import {
  getAdminAnalytics,
  getCustomerAnalytics,
  getOwnerAnalytics,
} from "../services/analytics.js";

export async function adminAnalytics(req, res) {
  const db = await getDb();
  const data = await getAdminAnalytics(db);
  res.status(200).json({ success: true, data });
}

export async function ownerAnalytics(req, res) {
  const db = await getDb();
  const data = await getOwnerAnalytics(db, req.user.email);
  res.status(200).json({ success: true, data });
}

export async function customerAnalytics(req, res) {
  const db = await getDb();
  const data = await getCustomerAnalytics(db, req.user.email);
  res.status(200).json({ success: true, data });
}
