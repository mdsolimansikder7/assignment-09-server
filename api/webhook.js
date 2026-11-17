import { verifyAndProcessStripeEvent } from "../src/controllers/payments.controller.js";

/**
 * Dedicated raw-body endpoint for Stripe on Vercel.
 * Vercel may pre-parse JSON bodies for the main function, which breaks
 * signature verification, so this function reads the body as text with the
 * Web API Request before anything parses it.
 */
export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const result = await verifyAndProcessStripeEvent(rawBody, signature);
  return Response.json(result.body, { status: result.status });
}
