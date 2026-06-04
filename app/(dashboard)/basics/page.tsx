import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The 101 — Basics",
  description:
    "A plain-English glossary of the tools and terms behind your app — GitHub, Supabase, Vercel, deploying, and more, explained with everyday analogies.",
};

type Term = { term: string; def: string; analogy: string };

const terms: Term[] = [
  {
    term: "GitHub",
    def: "Where your app's code lives online. It keeps every version, so you can always see what changed and go back if something breaks.",
    analogy: "Like a Google Drive for code — but it remembers every edit you ever made.",
  },
  {
    term: "Supabase",
    def: "Your app's database plus its login system. It stores your app's information and checks who is allowed to sign in.",
    analogy: "The filing cabinet that holds your data, plus the bouncer who checks who gets in the door.",
  },
  {
    term: "Vercel",
    def: "The hosting that puts your app on the internet at a real link, so anyone can visit it.",
    analogy: "The landlord who gives your app an address people can actually find.",
  },
  {
    term: "Claude Code / Codex",
    def: "The AI coding assistant that actually writes the app for you. You describe what you want, and it builds it.",
    analogy: "Like a builder you can talk to in plain English — you say the plan, they do the construction.",
  },
  {
    term: "Repo (repository)",
    def: "One project's folder of code on GitHub. Each app you build gets its own repo.",
    analogy: "A single project folder — one box for one project, neatly labeled.",
  },
  {
    term: "Deploy",
    def: "Pushing your latest changes live so visitors see the new version. Until you deploy, your changes only exist behind the scenes.",
    analogy: "Like flipping the sign to \"Open\" after you've rearranged the shop.",
  },
  {
    term: "Database",
    def: "Where your app remembers things — users, records, settings, and anything it needs to keep between visits.",
    analogy: "Your app's notebook — it writes things down so it doesn't forget.",
  },
  {
    term: "Domain / URL",
    def: "Your app's address on the web — the link people type or click to reach it.",
    analogy: "Like your home's street address, but for your app.",
  },
  {
    term: "Environment variables (env vars)",
    def: "Secret settings and keys your app needs to work, kept out of the code so they stay private.",
    analogy: "The spare keys you keep in a lockbox instead of taping them to the front door.",
  },
  {
    term: "Plan Pack",
    def: "The plan OnlyAIApp writes for your app — what to build and in what order — so the work has a clear path.",
    analogy: "A recipe that lists the steps in the right order, so nothing important gets skipped.",
  },
  {
    term: "Pilot",
    def: "OnlyAIApp watching your live apps and flagging problems or drift before they become real issues.",
    analogy: "Like a smoke detector for your apps — it warns you early when something's off.",
  },
  {
    term: "Provision",
    def: "OnlyAIApp setting all of the above up for you in one click — the repo, database, hosting, and keys, ready to go.",
    analogy: "Like getting a new home where the power, water, and internet are already switched on.",
  },
];

export default function BasicsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
      <header className="space-y-3">
        <Link
          href="/dashboard"
          className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          ← Dashboard
        </Link>
        <p className="eyebrow">Basics</p>
        <h1 className="text-3xl font-bold font-display tracking-tight text-on-surface">
          The 101 — plain-English glossary
        </h1>
        <p className="text-on-surface-variant">
          The tools and terms behind your app, explained simply — no jargon, just everyday analogies.
        </p>
      </header>

      <ul className="space-y-4">
        {terms.map((t) => (
          <li key={t.term} className="panel p-5">
            <h2 className="font-display font-semibold text-on-surface">{t.term}</h2>
            <p className="text-on-surface-variant mt-1.5 leading-relaxed">{t.def}</p>
            <p className="text-sm text-outline italic mt-2.5">{t.analogy}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
