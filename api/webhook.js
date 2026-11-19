import { verifyAndProcessStripeEvent } from "../src/controllers/payments.controller.js";

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const result = await verifyAndProcessStripeEvent(rawBody, signature);
  return Response.json(result.body, { status: result.status });
}
