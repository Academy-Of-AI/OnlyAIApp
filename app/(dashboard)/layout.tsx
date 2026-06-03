import { createClient } from "@/lib/supabase/server";
import { NotificationsBell } from "@/components/notifications-bell";
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

  const isPro = (profile?.plan ?? "free") === "pro";

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Top nav */}
      <header className="border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Logo → dashboard */}
        <Link href="/dashboard" className="font-bold text-sm shrink-0 hover:text-neutral-300 transition-colors">
          OnlyAIApp
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 text-sm min-w-0">
          {!isPro && (
            <Link href="/upgrade"
              className="bg-violet-500 hover:bg-violet-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0">
              ✨ Upgrade
            </Link>
          )}

          {/* Notification bell — beside username */}
          <NotificationsBell />

          {/* Username → billing/upgrade */}
          <Link
            href="/upgrade"
            className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors shrink-0 min-w-0"
            title="Account & billing"
          >
            <span className="text-neutral-400 truncate max-w-[140px] text-xs">
              {profile?.github_username ?? user.email}
            </span>
            <span className="bg-white/10 text-white/60 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              {profile?.plan ?? "free"}
            </span>
          </Link>

          {/* Settings */}
          <Link href="/settings" title="Settings"
            className="text-neutral-500 hover:text-white transition-colors text-base leading-none shrink-0">
            ⚙
          </Link>

          <form action={signOut}>
            <button type="submit" className="text-neutral-500 hover:text-white transition-colors text-xs shrink-0">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
