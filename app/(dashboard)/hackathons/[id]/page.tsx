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
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div>
        <Link href="/hackathons" className="text-on-surface-variant text-sm hover:text-on-surface">← Hackathons</Link>
        <div className="flex items-start justify-between mt-2 gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface">{hackathon.name}</h1>
            {hackathon.description && (
              <p className="text-on-surface-variant text-sm mt-1">{hackathon.description}</p>
            )}
          </div>
          <span className={`chip mt-1 whitespace-nowrap ${
            hackathon.status === "active" ? "chip-success" : "chip-neutral"
          }`}>
            {hackathon.status}
          </span>
        </div>
      </div>

      {/* Invite link */}
      <div className="panel p-5 space-y-3">
        <h2 className="font-semibold text-sm text-on-surface">Invite link</h2>
        <div className="flex gap-2">
          <code className="flex-1 bg-brand-container text-brand-dim text-sm px-3 py-2 rounded-lg font-mono truncate">
            {joinUrl}
          </code>
          <CopyButton text={joinUrl} />
        </div>
        <p className="text-xs text-on-surface-variant">
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
          <div key={s.label} className="tile text-center">
            <p className="text-2xl font-bold text-on-surface tabnum">{s.value}</p>
            <p className="text-xs text-on-surface-variant mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Participant table */}
      <div className="space-y-3">
        <h2 className="font-semibold text-on-surface">Participants</h2>
        {!participants?.length ? (
          <p className="text-on-surface-variant text-sm py-8 text-center">No participants yet. Share the invite link above.</p>
        ) : (
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant text-xs">
                  <th className="text-left px-4 py-3">Participant</th>
                  <th className="text-left px-4 py-3">Project</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Links</th>
                  <th className="text-left px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p, i) => {
                  const profileRaw = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
                  const projectRaw = Array.isArray(p.projects) ? p.projects[0] : p.projects;
                  const profile = profileRaw as unknown as { email: string; github_username: string } | null;
                  const project = projectRaw as unknown as { name: string; status: string; github_repo_url: string; vercel_preview_url: string } | null;
                  return (
                    <tr key={i} className="border-b border-outline-variant last:border-0 hover:bg-surface-high">
                      <td className="px-4 py-3 text-on-surface">
                        {profile?.github_username ? `@${profile.github_username}` : profile?.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{project?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`chip ${
                          project?.status === "deployed" ? "chip-success" :
                          project?.status === "provisioning" ? "chip-warn" :
                          project?.status === "failed" ? "chip-danger" :
                          "chip-neutral"
                        }`}>
                          {project?.status ?? "pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3 text-xs">
                          {project?.vercel_preview_url && (
                            <a href={project.vercel_preview_url} target="_blank" rel="noopener noreferrer"
                              className="text-brand hover:underline">Live →</a>
                          )}
                          {project?.github_repo_url && (
                            <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer"
                              className="text-on-surface-variant hover:text-on-surface">GitHub</a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-outline tabnum">
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
