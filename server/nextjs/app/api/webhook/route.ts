import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && signature) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  const dataObject = event.data.object;

  switch (event.type) {
    case "customer.created":
      console.log(`Successfully created customer: ${(dataObject as Stripe.Customer).id}`);
      break;
    case "customer.subscription.created":
      console.log(`Successfully created subscription: ${(dataObject as Stripe.Subscription).id}`);
      break;
    case "invoice.payment_succeeded":
      console.log("Invoice payment succeeded");
      break;
    case "invoice.payment_failed":
      console.log("Invoice payment failed");
      break;
    default:
      // Unhandled event type
      break;
  }

  return NextResponse.json({ received: true });
}
