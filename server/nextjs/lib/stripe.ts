import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
  appInfo: {
    name: "stripe-samples/subscriptions-with-card-and-direct-debit",
    version: "0.0.1",
    url: "https://github.com/stripe-samples/subscriptions-with-card-and-direct-debit",
  },
});
