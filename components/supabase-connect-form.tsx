"use client";

import { useState } from "react";

type Org = { id: string; name: string };

export function SupabaseConnectForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const [token, setToken] = useState("");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [stage, setStage] = useState<"token" | "org">("token");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSteps, setShowSteps] = useState(false);

  async function handleTokenSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/supabase/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json() as { orgs?: Org[]; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Invalid token — please check and try again.");
        setLoading(false);
        return;
      }

      const fetchedOrgs = data.orgs ?? [];

      if (fetchedOrgs.length === 1) {
        // Auto-proceed with the only org
        await saveConnection(fetchedOrgs[0].id);
      } else {
        setOrgs(fetchedOrgs);
        setSelectedOrgId(fetchedOrgs[0]?.id ?? "");
        setStage("org");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function handleOrgSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    await saveConnection(selectedOrgId);
  }

  async function saveConnection(orgId: string) {
    try {
      const res = await fetch("/api/supabase/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orgId }),
      });

      if (res.ok) {
        window.location.href = `${redirectTo}?connected=supabase`;
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to save connection.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 w-full">
      {stage === "token" ? (
        <form onSubmit={handleTokenSubmit} className="flex flex-col gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your Supabase token here…"
            required
            className="cap-input focus:border-[#3ECF8E] min-w-0"
          />
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full text-black text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap font-semibold"
            style={{ backgroundColor: "#3ECF8E" }}
          >
            {loading ? "Connecting…" : "⚡ Connect Supabase"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleOrgSubmit} className="space-y-2">
          <label className="text-xs text-on-surface-variant">Select your Supabase organization</label>
          <div className="flex flex-col gap-2">
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="cap-input focus:border-[#3ECF8E] min-w-0"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id} className="bg-surface-low">
                  {org.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading || !selectedOrgId}
              className="w-full text-black text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap font-semibold"
              style={{ backgroundColor: "#3ECF8E" }}
            >
              {loading ? "Saving…" : "Use this org →"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-xs text-danger px-1">{error}</p>}

      {/* Helper */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
        <span>
          No Supabase account?{" "}
          <a href="https://supabase.com/dashboard/sign-up" target="_blank" rel="noopener noreferrer"
            className="text-on-surface-variant hover:text-on-surface underline underline-offset-2">
            Create one free →
          </a>
        </span>
        <span>·</span>
        <button
          type="button"
          onClick={() => setShowSteps((s) => !s)}
          className="text-on-surface-variant hover:text-on-surface underline underline-offset-2 cursor-pointer"
        >
          {showSteps ? "Hide instructions ↑" : "How to get your token ↓"}
        </button>
      </div>

      {showSteps && (
        <div className="bg-surface border border-outline-variant rounded-xl p-4 space-y-3 text-sm">
          <p className="font-semibold text-on-surface text-xs uppercase tracking-wide">
            How to get your Supabase token — 3 steps
          </p>
          <ol className="space-y-3 text-on-surface-variant">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-high text-on-surface text-xs flex items-center justify-center font-bold">
                1
              </span>
              <span>
                Go to your Supabase account tokens page:{" "}
                <a
                  href="https://supabase.com/dashboard/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline font-mono text-xs"
                  style={{ color: "#3ECF8E" }}
                >
                  supabase.com/dashboard/account/tokens
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-high text-on-surface text-xs flex items-center justify-center font-bold">
                2
              </span>
              <span>
                Click <strong className="text-on-surface">Generate new token</strong>, name it{" "}
                <code
                  className="mono text-xs"
                  style={{ color: "#3ECF8E" }}
                >
                  vibe-launchpad
                </code>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-high text-on-surface text-xs flex items-center justify-center font-bold">
                3
              </span>
              <span>
                Copy and paste above —{" "}
                <strong className="text-on-surface">Supabase only shows it once</strong>.
              </span>
            </li>
          </ol>
          <p className="text-xs text-outline pt-1">
            🔒 Your token is encrypted before being stored. We only use it to provision databases.
          </p>
        </div>
      )}
    </div>
  );
}
