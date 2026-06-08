import { TRACKS } from "@/lib/tracks";
import Link from "next/link";

export const metadata = { title: "Tracks — OnlyAIApp" };

export default function TracksPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <p className="eyebrow">🧭 Studio</p>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface mt-1.5">Pick a track</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Each track ends with a real, deployed thing you own — not a certificate. Pick the outcome you want.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TRACKS.map((t) => (
          <div key={t.key} className="panel flex flex-col overflow-hidden hover:border-outline transition-all">
            <div className="p-5 flex flex-col gap-2 flex-1">
              <div className="text-2xl">{t.icon}</div>
              <h2 className="font-display font-semibold text-base text-on-surface">{t.title}</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">{t.desc}</p>
              <div className="text-xs text-on-surface-variant bg-surface-dim border border-outline-variant rounded-lg px-2.5 py-2 mt-1">
                You’ll ship: <b className="text-on-surface">{t.ship}</b>
              </div>
              <div className="flex gap-3 text-xs text-on-surface-variant mt-1">
                <span>⏱ <b className="text-on-surface">{t.time}</b></span>
                <span>📈 <b className="text-on-surface">{t.difficulty}</b></span>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-outline-variant flex items-center justify-between gap-2">
              <span className="text-xs text-on-surface-variant truncate">why: {t.why}</span>
              <Link href={`/scope?track=${t.key}`} className="btn-brand text-sm px-4 py-1.5 shrink-0">Start →</Link>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-outline text-center pt-2">
        Not sure? <Link href="/scope" className="text-brand-dim hover:underline">Just describe what you want →</Link>
      </p>
    </main>
  );
}
