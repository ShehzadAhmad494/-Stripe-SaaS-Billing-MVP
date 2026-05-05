"use client";

export default function CancelPage() {
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1 style={{ color: "red" }}>❌ Payment Cancelled</h1>

      <p>Your payment was not completed.</p>

      <a href="/checkout">
        <button
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          Retry Payment
        </button>
      </a>
    </div>
  );
}