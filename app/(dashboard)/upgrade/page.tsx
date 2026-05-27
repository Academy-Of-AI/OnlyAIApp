import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe";
import { redirect } from "next/navigation";

const tiers = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["3 projects", "1 template", "Community support"],
    cta: "Current plan",
    priceId: null,
    highlighted: false,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    period: "/month",
    features: [
      "Unlimited projects",
      "All templates",
      "Priority provisioning",
      "Stripe Connect revenue share",
    ],
    cta: "Upgrade to Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    highlighted: true,
  },
  {
    key: "org",
    name: "Org",
    price: "$99",
    period: "/month",
    features: [
      "Everything in Pro",
      "Hackathon mode",
      "Organizer dashboard",
      "Invite codes + bulk onboarding",
      "Custom templates",
      "White-label branding",
    ],
    cta: "Upgrade to Org",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ORG,
    highlighted: false,
  },
];

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles").select("plan").eq("id", user.id).single();
  const currentPlan = profile?.plan ?? "free";

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
      {params.upgraded && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg text-center">
          🎉 You&apos;re now on Pro. Welcome to the fast lane.
        </div>
      )}

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Pick your plan</h1>
        <p className="text-neutral-400">Start free. Upgrade when you&apos;re ready to scale.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.key}
            className={`rounded-xl p-6 space-y-5 border ${
              tier.highlighted
                ? "border-green-500/50 bg-green-500/5"
                : "border-white/10"
            }`}
          >
            {tier.highlighted && (
              <span className="text-xs bg-green-500 text-black font-semibold px-2 py-0.5 rounded-full">
                Most popular
              </span>
            )}
            <div>
              <h2 className="font-bold text-lg">{tier.name}</h2>
              <p className="text-3xl font-bold mt-1">
                {tier.price}
                <span className="text-sm font-normal text-neutral-400">{tier.period}</span>
              </p>
            </div>
            <ul className="space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-neutral-300">
                  <span className="text-green-400">✓</span> {f}
                </li>
              ))}
            </ul>
            {currentPlan === tier.key ? (
              <div className="w-full text-center text-sm text-neutral-500 py-2 border border-white/10 rounded-lg">
                Current plan
              </div>
            ) : tier.priceId ? (
              <CheckoutButton priceId={tier.priceId} label={tier.cta} />
            ) : null}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-neutral-600">
        All plans include Stripe Connect revenue share. Cancel anytime. No hidden fees.
      </p>
    </main>
  );
}

function CheckoutButton({ priceId, label }: { priceId: string; label: string }) {
  async function checkout() {
    "use server";
    // Handled client-side for redirect
  }
  return (
    <form
      onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId }),
        });
        const { url } = await res.json();
        window.location.href = url;
      }}
      // Server action fallback: render as client form
    >
      <button
        type="submit"
        className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-2.5 rounded-lg transition-colors text-sm"
      >
        {label}
      </button>
    </form>
  );
}
