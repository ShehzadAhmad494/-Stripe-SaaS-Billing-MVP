"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: "http://localhost:3001/success",
      },
    });

    if (result.error) {
      console.log("Payment Error:", result.error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={!stripe}>
        Pay Now
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const createPaymentIntent = async () => {
      try {
        setLoading(true);

        // ✅ stable idempotency key
        let idempotencyKey = localStorage.getItem("idempotencyKey");

        if (!idempotencyKey) {
          idempotencyKey = crypto.randomUUID();
          localStorage.setItem("idempotencyKey", idempotencyKey);
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/payment/create-intent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: "Shehzad Ahmad",
              amount: 30000,
              currency: "usd",
              idempotencyKey,
            }),
          }
        );

        const data = await response.json();

        if (!mounted) return;

        if (!data.clientSecret) {
          console.error("🔴 Missing clientSecret from backend");
          setClientSecret(null);
          return;
        }

        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error("Payment Intent Error:", error);
        setClientSecret(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    createPaymentIntent();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <p>Loading payment form...</p>;

  if (!clientSecret) return <p>Payment setup failed. Try again.</p>;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm />
    </Elements>
  );
}