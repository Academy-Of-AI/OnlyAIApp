import { createClient } from "@/lib/supabase/server";
import { NotificationsBell } from "@/components/notifications-bell";
import { DashboardSidebar, MobileNav } from "@/components/dashboard-sidebar";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("github_username, plan")
    .eq("id", user.id)
    .single();
  const plan = profile?.plan ?? "free";

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)]">
      <DashboardSidebar plan={plan} />

      {/* Main column, offset by the sidebar width on desktop */}
      <div className="md:pl-56 flex flex-col min-h-screen">
        {/* Slim top bar */}
        <header className="h-16 border-b border-[var(--color-outline-variant)] px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 bg-[color-mix(in_srgb,var(--color-surface)_85%,transparent)] backdrop-blur z-10">
          {/* Mobile logo (desktop logo is in the sidebar) */}
          <Link href="/dashboard" className="font-display font-bold text-sm md:hidden">OnlyAIApp</Link>
          <div className="hidden md:block" />

          <div className="flex items-center gap-3 shrink-0">
            <NotificationsBell />
            <Link href="/settings" title="Account &amp; settings"
              className="hidden sm:flex items-center gap-2 min-w-0 group">
              <span className="w-7 h-7 rounded-full grid place-items-center text-white text-[11px] font-semibold shrink-0" style={{ background: "linear-gradient(135deg, var(--color-brand), #9333ea)" }}>
                {(profile?.github_username ?? user.email ?? "?").slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[var(--color-on-surface-variant)] group-hover:text-[var(--color-on-surface)] truncate max-w-[140px] text-xs transition-colors">
                {profile?.github_username ?? user.email}
              </span>
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors text-xs">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <MobileNav />

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
