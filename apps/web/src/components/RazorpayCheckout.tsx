// apps/web/src/components/RazorpayCheckout.tsx
//
// ✅ Web Razorpay checkout — uses the official Razorpay JS SDK.
// No expo-web-browser hack needed. This is the clean web approach.
//
// Usage:
//   <RazorpayCheckout orderId={orderId} amount={49900} onSuccess={handleSuccess} />

"use client";

import { useEffect } from "react";
import { useStudentProfile } from "@gloows/shared-logic";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name?: string; email?: string; contact?: string };
  theme: { color: string };
  handler: (response: any) => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open(): void;
      on(event: "payment.failed", handler: (response: { error: { description?: string } }) => void): void;
    };
  }
}

interface Props {
  orderId: string;
  amount: number;           // in paise
  description?: string;
  onSuccess: (paymentId: string, orderId: string, signature: string) => void;
  onError?: (error: string) => void;
  children?: React.ReactNode;
}

export function RazorpayCheckout({ orderId, amount, description, onSuccess, onError, children }: Props) {
  // Load Razorpay script
  useEffect(() => {
    if (window.Razorpay) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const { studentProfile, user } = useStudentProfile();

  const openCheckout = () => {
    if (!window.Razorpay) {
      onError?.("Payment gateway not loaded. Please try again.");
      return;
    }
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) {
      onError?.("Payment isn't configured yet. Please contact support.");
      return;
    }
    const rzp = new window.Razorpay({
      key:         keyId,
      amount,
      currency:    "INR",
      name:        "Gloows365E",
      description: description ?? "Subscription",
      order_id:    orderId,
      prefill: {
        name:    studentProfile?.name,
        email:   user?.email ?? undefined,
        contact: studentProfile?.phone,
      },
      theme: { color: "#6366f1" },
      handler: (response) => {
        onSuccess(
          response.razorpay_payment_id,
          response.razorpay_order_id,
          response.razorpay_signature
        );
      },
    });
    rzp.on("payment.failed", (response) => {
      onError?.(response.error?.description ?? "Payment failed. Please try again.");
    });
    rzp.open();
  };

  return (
    <button
      onClick={openCheckout}
      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors w-full"
    >
      {children ?? "Pay Now"}
    </button>
  );
}
