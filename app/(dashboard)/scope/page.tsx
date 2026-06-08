import { ScopeForm } from "@/components/scope-form";
import { getTrack } from "@/lib/tracks";
import Link from "next/link";

export default async function ScopePage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const { track: trackKey } = await searchParams;
  const track = getTrack(trackKey);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <p className="eyebrow">🧭 Start a build</p>
        <h1 className="text-2xl font-bold tracking-tight font-display text-on-surface mt-1.5">
          {track ? `${track.icon} ${track.title}` : "Scope your build"}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Tell us the messy, repetitive thing you want handled. Answer a few questions and we’ll
          narrow it to a buildable v1 — then turn it into your project.
        </p>
      </div>

      {track && (
        <div className="panel border-l-[3px] border-l-brand p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-on-surface">
            <span className="font-medium">You’ll ship:</span> {track.ship}
            <span className="text-on-surface-variant"> · ⏱ {track.time} · 📈 {track.difficulty}</span>
          </p>
          <Link href="/tracks" className="text-xs text-brand-dim hover:underline shrink-0">← change track</Link>
        </div>
      )}

      <ScopeForm initial={track?.prefill ?? {}} modifier={track?.modifier ?? ""} trackKey={track?.key ?? ""} />
    </main>
  );
}
