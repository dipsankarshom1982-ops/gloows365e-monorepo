// apps/web/src/components/RazorpayCheckout.tsx
//
// ✅ Web Razorpay checkout — uses the official Razorpay JS SDK.
// No expo-web-browser hack needed. This is the clean web approach.
//
// Usage:
//   <RazorpayCheckout orderId={orderId} amount={49900} onSuccess={handleSuccess} />

"use client";

import { useEffect, useRef, useState } from "react";
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
  modal?: { ondismiss?: () => void };
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
  /** Called when the user closes the checkout modal without completing or
   *  failing a payment — distinct from onError, which Razorpay only fires
   *  for an actual payment.failed event. Optional: callers that already
   *  treat "no update yet" as fine (e.g. the order stays valid to retry)
   *  can leave this unset. */
  onDismiss?: () => void;
  children?: React.ReactNode;
}

export function RazorpayCheckout({ orderId, amount, description, onSuccess, onError, onDismiss, children }: Props) {
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

  // Guards duplicate clicks — e.g. a fast double-click before the SDK has
  // responded to the first .open() — from stacking a second modal/order.
  // Cleared on payment.failed, on modal dismiss, and once the success
  // handler hands off to the caller (whose own onSuccess is responsible
  // for its own follow-up loading state, e.g. SubscriptionScreen's
  // pollForActivation).
  const [isOpening, setIsOpening] = useState(false);
  const isOpeningRef = useRef(false);

  const openCheckout = () => {
    if (isOpeningRef.current) return;
    if (!window.Razorpay) {
      onError?.("Payment gateway not loaded. Please try again.");
      return;
    }
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) {
      onError?.("Payment isn't configured yet. Please contact support.");
      return;
    }

    isOpeningRef.current = true;
    setIsOpening(true);

    let rzp;
    try {
      rzp = new window.Razorpay({
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
          isOpeningRef.current = false;
          setIsOpening(false);
          onSuccess(
            response.razorpay_payment_id,
            response.razorpay_order_id,
            response.razorpay_signature
          );
        },
        modal: {
          // Fires when the user closes the modal without paying — never
          // fired alongside payment.failed or handler, so this and those
          // two are mutually exclusive per checkout attempt.
          ondismiss: () => {
            isOpeningRef.current = false;
            setIsOpening(false);
            onDismiss?.();
          },
        },
      });
    } catch (e: any) {
      isOpeningRef.current = false;
      setIsOpening(false);
      onError?.(e?.message ?? "Could not open the payment window. Please try again.");
      return;
    }
    rzp.on("payment.failed", (response) => {
      isOpeningRef.current = false;
      setIsOpening(false);
      onError?.(response.error?.description ?? "Payment failed. Please try again.");
    });
    rzp.open();
  };

  return (
    <button
      onClick={openCheckout}
      disabled={isOpening}
      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors w-full disabled:opacity-50 disabled:cursor-default"
    >
      {children ?? "Pay Now"}
    </button>
  );
}
