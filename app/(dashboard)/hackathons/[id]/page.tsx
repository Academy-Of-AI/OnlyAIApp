import { CopyButton } from "@/components/copy-button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HackathonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: hackathon } = await supabase
    .from("hackathons").select("*").eq("id", id).eq("organizer_id", user.id).single();
  if (!hackathon) redirect("/hackathons");

  const { data: participants } = await supabase
    .from("hackathon_participants")
    .select(`joined_at, profiles(email, github_username), projects(name, status, github_repo_url, vercel_preview_url)`)
    .eq("hackathon_id", id)
    .order("joined_at", { ascending: true });

  const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://vibelaunchpad.com"}/join/${hackathon.invite_code}`;
  const deployed = participants?.filter((p) => {
    const proj = Array.isArray(p.projects) ? p.projects[0] : p.projects;
    return (proj as { status: string } | null)?.status === "deployed";
  }).length ?? 0;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <Link href="/hackathons" className="text-neutral-500 text-sm hover:text-white">← Hackathons</Link>
        <div className="flex items-start justify-between mt-2 gap-4">
          <div>
            <h1 className="text-2xl font-bold">{hackathon.name}</h1>
            {hackathon.description && (
              <p className="text-neutral-400 text-sm mt-1">{hackathon.description}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full mt-1 whitespace-nowrap ${
            hackathon.status === "active" ? "bg-green-500/20 text-green-400" : "bg-neutral-500/20 text-neutral-400"
          }`}>
            {hackathon.status}
          </span>
        </div>
      </div>

      {/* Invite link */}
      <div className="border border-white/10 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Invite link</h2>
        <div className="flex gap-2">
          <code className="flex-1 bg-white/5 text-green-400 text-sm px-3 py-2 rounded-lg font-mono truncate">
            {joinUrl}
          </code>
          <CopyButton text={joinUrl} />
        </div>
        <p className="text-xs text-neutral-500">
          Share this link. Participants sign up, connect GitHub + Vercel, and get a live app in ~60 seconds.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Participants", value: participants?.length ?? 0 },
          { label: "Deployed", value: deployed },
          { label: "Capacity", value: hackathon.max_participants },
        ].map((s) => (
          <div key={s.label} className="border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-neutral-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Participant table */}
      <div className="space-y-3">
        <h2 className="font-semibold">Participants</h2>
        {!participants?.length ? (
          <p className="text-neutral-500 text-sm py-8 text-center">No participants yet. Share the invite link above.</p>
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-neutral-500 text-xs">
                  <th className="text-left px-4 py-3">Participant</th>
                  <th className="text-left px-4 py-3">Project</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Links</th>
                  <th className="text-left px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p, i) => {
                  const profile = p.profiles as { email: string; github_username: string } | null;
                  const project = p.projects as { name: string; status: string; github_repo_url: string; vercel_preview_url: string } | null;
                  return (
                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                      <td className="px-4 py-3 text-neutral-300">
                        {profile?.github_username ? `@${profile.github_username}` : profile?.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-400">{project?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          project?.status === "deployed" ? "bg-green-500/20 text-green-400" :
                          project?.status === "provisioning" ? "bg-yellow-500/20 text-yellow-400" :
                          project?.status === "failed" ? "bg-red-500/20 text-red-400" :
                          "bg-neutral-500/20 text-neutral-400"
                        }`}>
                          {project?.status ?? "pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3 text-xs">
                          {project?.vercel_preview_url && (
                            <a href={project.vercel_preview_url} target="_blank" rel="noopener noreferrer"
                              className="text-green-400 hover:underline">Live →</a>
                          )}
                          {project?.github_repo_url && (
                            <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer"
                              className="text-neutral-400 hover:text-white">GitHub</a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        {new Date(p.joined_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

// CopyButton imported from components/copy-button.tsx (client component)
