"use client";

export function VercelConnectForm() {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = (e.currentTarget.elements.namedItem("token") as HTMLInputElement).value;
    const res = await fetch("/api/vercel/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      window.location.href = "/dashboard?connected=vercel";
    } else {
      const { error } = await res.json();
      alert(error ?? "Invalid token. Get it from vercel.com/account/tokens");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        name="token"
        type="password"
        placeholder="Paste Vercel token…"
        className="bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-green-500 w-56"
      />
      <button
        type="submit"
        className="bg-black border border-white/20 text-white text-sm px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        ▲ Connect Vercel
      </button>
    </form>
  );
}
