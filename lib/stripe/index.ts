import Stripe from "stripe";

// Lazy singleton — avoids Stripe throwing at module load time when
// STRIPE_SECRET_KEY is not available (e.g. during Next.js build analysis).
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}
// Proxy so callers can still write `stripe.xxx` without changes.
export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string) {
    return (getStripe() as unknown as Record<string, unknown>)[prop];
  },
});

export const PLANS = {
  free: { name: "Free", price: 0, projects: 3 },
  pro:  { name: "Pro",  price: 19, projects: Infinity },
  org:  { name: "Org",  price: 99, projects: Infinity },
} as const;

/** One-time credit packs — sold via Stripe checkout with price_data */
export const CREDIT_PACKS = {
  starter:    { credits: 5,  amountCents: 500,  label: "5 builds",  badge: "Starter"    },
  builder:    { credits: 15, amountCents: 1200, label: "15 builds", badge: "Builder"    },
  accelerate: { credits: 30, amountCents: 2000, label: "30 builds", badge: "Best value" },
} as const;

export type CreditPackKey = keyof typeof CREDIT_PACKS;

export async function createCheckoutSession({
  userId,
  priceId,
  customerId,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  priceId: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
    ...(customerId
      ? { customer: customerId }
      : { customer_creation: "always" }),
  });
}

export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export function constructWebhookEvent(payload: string, sig: string) {
  return stripe.webhooks.constructEvent(
    payload,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}
