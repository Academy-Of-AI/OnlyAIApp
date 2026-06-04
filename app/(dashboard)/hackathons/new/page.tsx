"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewHackathonPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    maxParticipants: "200",
    startsAt: "",
    endsAt: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/hackathons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        maxParticipants: Number(form.maxParticipants),
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create hackathon");
      setLoading(false);
      return;
    }

    router.push(`/hackathons/${data.id}`);
  }

  return (
    <main className="max-w-lg mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
      <div>
        <Link href="/hackathons" className="text-on-surface-variant text-sm hover:text-on-surface">← Hackathons</Link>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface mt-2">New hackathon</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Share your invite link — participants get a live app in under 2 minutes.
        </p>
      </div>

      <form onSubmit={create} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-on-surface">Event name</label>
          <input value={form.name} onChange={set("name")} required placeholder="YC Hackathon Spring 2026"
            className="cap-input" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-on-surface">Description <span className="text-outline">(optional)</span></label>
          <textarea value={form.description} onChange={set("description")} rows={3} placeholder="What are you building?"
            className="cap-input resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface">Starts</label>
            <input type="datetime-local" value={form.startsAt} onChange={set("startsAt")}
              className="cap-input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface">Ends</label>
            <input type="datetime-local" value={form.endsAt} onChange={set("endsAt")}
              className="cap-input" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-on-surface">Max participants</label>
          <input type="number" value={form.maxParticipants} onChange={set("maxParticipants")} min={1} max={10000}
            className="cap-input tabnum" />
        </div>

        {error && (
          <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.3)] text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <button type="submit" disabled={loading || !form.name}
          className="w-full btn-brand py-3 transition-colors">
          {loading ? "Creating…" : "Create hackathon →"}
        </button>
      </form>
    </main>
  );
}
