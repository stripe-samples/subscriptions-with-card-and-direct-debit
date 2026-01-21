import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json();

    // Create a new customer
    const customer = await stripe.customers.create({
      name,
      email,
    });

    // Create a SetupIntent for recurring usage
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card", "au_becs_debit"],
      customer: customer.id,
    });

    return NextResponse.json({ customer, setupIntent });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
