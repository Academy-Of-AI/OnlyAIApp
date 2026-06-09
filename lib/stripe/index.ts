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

// Keep in sync with lib/plan.ts (PROJECT_LIMITS). Prices in whole USD/mo.
export const PLANS = {
  free: { name: "Free", price: 0,  projects: 2 },
  core: { name: "Core", price: 8,  projects: 8 },
  pro:  { name: "Pro",  price: 17, projects: 8 },
} as const;

/** One-time credit packs — sold via Stripe checkout with price_data */
export const CREDIT_PACKS = {
  starter:    { credits: 3,  amountCents: 1000, label: "3 builds",  badge: "Starter"    },
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

/* ── Connect (managed payments via hosted onboarding) ───────────────────── */

/** Create a connected account matching the platform's controller config:
 *  direct charges · full Stripe dashboard · Stripe-hosted onboarding. */
export async function createConnectedAccount(): Promise<string> {
  const account = await stripe.accounts.create({
    controller: {
      stripe_dashboard: { type: "full" },
      fees: { payer: "account" },
      losses: { payments: "stripe" },
      requirement_collection: "stripe",
    },
  });
  return account.id;
}

/** Hosted onboarding link for a connected account. */
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/** Whether the connected account finished onboarding + can take payments. */
export async function getAccountStatus(
  accountId: string,
): Promise<{ chargesEnabled: boolean; detailsSubmitted: boolean }> {
  const a = await stripe.accounts.retrieve(accountId);
  return { chargesEnabled: !!a.charges_enabled, detailsSubmitted: !!a.details_submitted };
}
