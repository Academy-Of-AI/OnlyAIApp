"use client";

import { useState } from "react";
import { VercelConnectForm } from "@/components/vercel-connect-form";
import { SupabaseConnectForm } from "@/components/supabase-connect-form";
import { ResendConnectForm } from "@/components/resend-connect-form";

type Provider = "github" | "vercel" | "supabase" | "resend";

export function UpdateConnectionButton({
  provider,
  label = "Update",
}: {
  provider: Provider;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-on-surface-variant hover:text-on-surface underline underline-offset-2 transition-colors"
      >
        {open ? "Cancel" : label}
      </button>

      {open && (
        <div className="mt-3">
          {provider === "vercel"   && <VercelConnectForm />}
          {provider === "supabase" && <SupabaseConnectForm />}
          {provider === "resend"   && <ResendConnectForm />}
          {provider === "github"   && (
            <a
              href="/api/github/connect"
              className="btn-brand flex items-center justify-center gap-2 text-sm px-4 py-2 transition-colors w-full"
            >
              Reconnect GitHub →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
