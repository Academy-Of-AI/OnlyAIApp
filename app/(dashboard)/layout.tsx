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
    .select("plan, github_username")
    .eq("id", user.id)
    .single();

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  }

  const plan = profile?.plan ?? "free";

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <DashboardSidebar plan={plan} />

      {/* Main column, offset by the sidebar width on desktop */}
      <div className="md:pl-56 flex flex-col min-h-screen">
        {/* Slim top bar */}
        <header className="h-14 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 bg-neutral-950/90 backdrop-blur z-10">
          {/* Mobile logo (desktop logo is in the sidebar) */}
          <Link href="/dashboard" className="font-bold text-sm md:hidden">OnlyAIApp</Link>
          <div className="hidden md:block" />

          <div className="flex items-center gap-3 shrink-0">
            <NotificationsBell />
            <Link href="/upgrade" title="Account & billing"
              className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors min-w-0">
              <span className="text-neutral-400 truncate max-w-[140px] text-xs">
                {profile?.github_username ?? user.email}
              </span>
              <span className="bg-white/10 text-white/60 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                {plan}
              </span>
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-neutral-500 hover:text-white transition-colors text-xs">
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
