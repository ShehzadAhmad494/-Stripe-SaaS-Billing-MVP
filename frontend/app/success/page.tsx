"use client";

import { useEffect, useState } from "react";

export default function SuccessPage() {
  const [status, setStatus] = useState<string>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const paymentIntent = url.searchParams.get("payment_intent");

    if (!paymentIntent) {
      setError("Missing payment intent");
      setStatus("failed");
      return;
    }

    const verifyPayment = async () => {
      try {
        const res = await fetch(
          `http://localhost:3000/payment/status/${paymentIntent}`
        );

        const data = await res.json();

        setStatus(data.status);
      } catch (err) {
        console.error(err);
        setError("Verification failed");
        setStatus("failed");
      }
    };

    verifyPayment();
  }, []);

  return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <h1>Payment Status</h1>

      {status === "loading" && <p>Verifying payment...</p>}

      {status === "succeeded" && (
        <h2 style={{ color: "green" }}>Payment Successful 🎉</h2>
      )}

      {status === "failed" && (
        <h2 style={{ color: "red" }}>
          Payment Failed ❌ {error && `(${error})`}
        </h2>
      )}
    </div>
  );
}