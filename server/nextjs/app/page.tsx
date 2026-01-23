"use client";

import { useState, useEffect, FormEvent } from "react";
import { loadStripe, Stripe, StripeElements } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  AuBankAccountElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/get-stripe";
import Image from "next/image";

interface Plan {
  amount: number;
  currency: string;
  interval: string;
}

interface CustomerData {
  customer: { id: string };
  setupIntent: { client_secret: string };
}

function SignupForm({
  onSubmit,
}: {
  onSubmit: (name: string, email: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(name, email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Jenny Rosen"
        required
        className="w-full p-3 border rounded-md"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="jenny.rosen@example.com"
        required
        className="w-full p-3 border rounded-md"
      />
      <button
        type="submit"
        className="w-full bg-stripe-purple text-white py-3 rounded-md font-semibold hover:bg-opacity-90"
      >
        Signup
      </button>
    </form>
  );
}

function PaymentForm({
  customerData,
  billingName,
  billingEmail,
  onComplete,
}: {
  customerData: CustomerData;
  billingName: string;
  billingEmail: string;
  onComplete: (subscription: object) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "au_becs_debit">("card");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      let result;

      if (paymentMethod === "card") {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          setError("Card element not found");
          setLoading(false);
          return;
        }

        result = await stripe.confirmCardSetup(customerData.setupIntent.client_secret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: billingName,
              email: billingEmail,
            },
          },
        });
      } else {
        const becsElement = elements.getElement(AuBankAccountElement);
        if (!becsElement) {
          setError("BECS element not found");
          setLoading(false);
          return;
        }

        result = await stripe.confirmAuBecsDebitSetup(
          customerData.setupIntent.client_secret,
          {
            payment_method: {
              au_becs_debit: becsElement,
              billing_details: {
                name: billingName,
                email: billingEmail,
              },
            },
          }
        );
      }

      if (result.error) {
        setError(result.error.message || "An error occurred");
        setLoading(false);
        return;
      }

      // Create subscription
      const subscriptionRes = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerData.customer.id,
          paymentMethodId: result.setupIntent?.payment_method,
        }),
      });

      const subscription = await subscriptionRes.json();
      onComplete(subscription);
    } catch (err) {
      setError("An error occurred");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="payment"
            value="card"
            checked={paymentMethod === "card"}
            onChange={() => setPaymentMethod("card")}
          />
          Card
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="payment"
            value="au_becs_debit"
            checked={paymentMethod === "au_becs_debit"}
            onChange={() => setPaymentMethod("au_becs_debit")}
          />
          BECS Debit
        </label>
      </div>

      {paymentMethod === "card" && (
        <div className="p-3 border rounded-md bg-white">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#32325d",
                  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                },
              },
            }}
          />
        </div>
      )}

      {paymentMethod === "au_becs_debit" && (
        <div>
          <div className="p-3 border rounded-md bg-white mb-4">
            <AuBankAccountElement
              options={{
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#32325d",
                    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                  },
                },
              }}
            />
          </div>
          <p className="text-xs text-gray-600">
            By providing your bank account details and confirming this payment,
            you agree to this Direct Debit Request and the Direct Debit Request
            service agreement, and authorise Stripe Payments Australia Pty Ltd
            to debit your account through BECS.
          </p>
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-stripe-purple text-white py-3 rounded-md font-semibold hover:bg-opacity-90 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Subscribe"}
      </button>
    </form>
  );
}

function CompletedView({ subscription }: { subscription: object }) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold mb-4 text-green-600">
        Your subscription is active
      </h1>
      <div className="bg-stripe-light p-4 rounded-md overflow-auto max-h-64 mb-6 text-left">
        <pre className="text-xs">{JSON.stringify(subscription, null, 2)}</pre>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="w-full bg-stripe-purple text-white py-3 rounded-md font-semibold hover:bg-opacity-90"
      >
        Restart demo
      </button>
    </div>
  );
}

export default function Home() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState<"signup" | "payment" | "complete">("signup");
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [billingInfo, setBillingInfo] = useState({ name: "", email: "" });
  const [subscription, setSubscription] = useState<object | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setPlan(data.plan))
      .catch(console.error);
  }, []);

  const handleSignup = async (name: string, email: string) => {
    setBillingInfo({ name, email });

    const res = await fetch("/api/create-customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    const data = await res.json();
    setCustomerData(data);
    setStep("payment");
  };

  const handleComplete = (sub: object) => {
    setSubscription(sub);
    setStep("complete");
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount / 100);
  };

  return (
    <main className="flex min-h-screen">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">
                {plan
                  ? `${formatPrice(plan.amount, plan.currency)} per ${plan.interval}`
                  : "Loading..."}
              </h1>
              <p className="text-gray-600">Subscribe to the 3 photo plan</p>
            </div>

            {step === "signup" && <SignupForm onSubmit={handleSignup} />}

            {step === "payment" && customerData && (
              <Elements stripe={getStripe()}>
                <PaymentForm
                  customerData={customerData}
                  billingName={billingInfo.name}
                  billingEmail={billingInfo.email}
                  onComplete={handleComplete}
                />
              </Elements>
            )}

            {step === "complete" && subscription && (
              <CompletedView subscription={subscription} />
            )}
          </div>
        </div>
      </div>

      <div className="hidden md:flex flex-1 items-center justify-center bg-stripe-dark p-8">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Image
              key={i}
              src={`https://picsum.photos/280/320?random=${i}`}
              alt={`Photo ${i}`}
              width={140}
              height={160}
              className="rounded-md"
              unoptimized
            />
          ))}
        </div>
      </div>
    </main>
  );
}
