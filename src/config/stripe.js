import Stripe from "stripe";
import { env } from "./env.js";

let stripeClient = null;

export function getStripe() {
  if (!env.stripeSecretKey) {
    const error = new Error("Stripe is not configured");
    error.status = 503;
    throw error;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey);
  }

  return stripeClient;
}
