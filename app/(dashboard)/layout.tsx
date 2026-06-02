import { createClient } from "@/lib/supabase/server";
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

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Top nav */}
      <header className="border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="font-bold text-sm shrink-0">🚀 Launchpad</Link>
        <div className="flex items-center gap-3 sm:gap-4 text-sm min-w-0">
          {(profile?.plan ?? "free") !== "pro" && (
            <Link href="/upgrade"
              className="bg-violet-500 hover:bg-violet-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0">
              ✨ Upgrade
            </Link>
          )}
          <span className="hidden sm:inline text-neutral-400 truncate max-w-[180px]">
            {profile?.github_username ?? user.email}
          </span>
          <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">
            {profile?.plan ?? "free"}
          </span>
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
