import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HackathonsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles").select("plan").eq("id", user.id).single();
  const isOrg = profile?.plan === "org";

  const { data: hackathons } = isOrg
    ? await supabase
        .from("hackathons")
        .select("*, hackathon_participants(count)")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Hackathons</h1>
          <p className="text-neutral-400 text-sm mt-0.5">
            Run events where participants get provisioned environments instantly.
          </p>
        </div>
        {isOrg && (
          <Link
            href="/hackathons/new"
            className="bg-green-500 hover:bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New hackathon
          </Link>
        )}
      </div>

      {!isOrg && (
        <div className="border border-white/10 rounded-xl p-8 text-center space-y-4">
          <p className="text-3xl">🏆</p>
          <h2 className="font-semibold">Hackathon mode is an Org plan feature</h2>
          <p className="text-neutral-400 text-sm max-w-sm mx-auto">
            Run events with 200+ participants. Each gets a full-stack environment in
            under 2 minutes via a single invite link.
          </p>
          <Link
            href="/upgrade"
            className="inline-block bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            Upgrade to Org — $99/mo
          </Link>
        </div>
      )}

      {isOrg && hackathons?.length === 0 && (
        <div className="text-center py-16 text-neutral-500 space-y-2">
          <p className="text-3xl">🏁</p>
          <p>No hackathons yet.</p>
          <Link href="/hackathons/new" className="text-green-400 hover:underline text-sm">
            Create your first event →
          </Link>
        </div>
      )}

      {isOrg && !!hackathons?.length && (
        <div className="space-y-3">
          {hackathons.map((h) => {
            const count = (h.hackathon_participants as unknown as [{ count: number }])[0]?.count ?? 0;
            return (
              <Link
                key={h.id}
                href={`/hackathons/${h.id}`}
                className="flex items-center justify-between border border-white/10 hover:border-white/20 rounded-xl px-5 py-4 transition-colors group"
              >
                <div className="space-y-1">
                  <p className="font-medium group-hover:text-green-400 transition-colors">{h.name}</p>
                  <p className="text-xs text-neutral-500 font-mono">
                    Invite: <span className="text-white">{h.invite_code}</span>
                    {" · "}
                    vibelaunchpad.com/join/{h.invite_code}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    h.status === "active" ? "bg-green-500/20 text-green-400" : "bg-neutral-500/20 text-neutral-400"
                  }`}>
                    {h.status}
                  </span>
                  <p className="text-xs text-neutral-500">{count} / {h.max_participants} participants</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
