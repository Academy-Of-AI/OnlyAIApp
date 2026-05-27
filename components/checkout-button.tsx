"use client";

export function CheckoutButton({ priceId, label }: { priceId: string; label: string }) {
  async function handleClick() {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const { url, error } = await res.json();
    if (error) {
      alert(error);
      return;
    }
    window.location.href = url;
  }

  return (
    <button
      onClick={handleClick}
      className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-2.5 rounded-lg transition-colors text-sm"
    >
      {label}
    </button>
  );
}
