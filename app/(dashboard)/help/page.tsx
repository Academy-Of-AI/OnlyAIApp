import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "Answers to common questions about OnlyAIApp — getting started, plans & billing, connecting services, building your app, Pilot, and your account.",
};

type FaqItem = { q: string; a: string };
type FaqSection = { label: string; items: FaqItem[] };

const sections: FaqSection[] = [
  {
    label: "Getting started",
    items: [
      {
        q: "What is OnlyAIApp?",
        a: "OnlyAIApp turns your idea into a real, working app. You describe what you want — or upload a PRD — and we set up the repo, database, and hosting for you and write a clear build plan. From there your own AI coder, Claude Code, does the actual building, following the plan we wrote into your project.",
      },
      {
        q: "Do I need to know how to code?",
        a: "No. OnlyAIApp is built for non-technical people — you bring the idea, we handle the setup and the plan. You do need your own Claude Code (or Codex) subscription, because that AI is what writes the code. Think of us as the foreman and the blueprint, and your AI as the builder.",
      },
      {
        q: "Why is sign-in only with GitHub?",
        a: "Your app's code lives on GitHub, so signing in there means everything is connected from the very first click. It also keeps things simple and secure: one login, no extra password to forget. One GitHub account equals one OnlyAIApp account.",
      },
      {
        q: "I don't have a GitHub account.",
        a: "No problem — it's free. Head to github.com, create an account (it takes a couple of minutes), then come back here and connect it. Once you're signed in with GitHub you can provision your first project.",
      },
      {
        q: 'What is a "Plan Pack"?',
        a: "A Plan Pack is the clear plan we write for your app: a PRD (what you're building and why), the architecture, the data model, and a set of sprints to build it in. We commit it straight into your repo so your AI coder has exactly the right instructions and builds the right thing — not a random guess.",
      },
      {
        q: "What gets created when I provision a project?",
        a: "One click sets up three things and wires them together: a private GitHub repo for your code, a Supabase database for your data and logins, and live Vercel hosting so your app has a real link on the internet. You don't have to configure any of it by hand.",
      },
      {
        q: "What's the very first thing I should do?",
        a: "Sign in with GitHub, then provision your first project by describing your idea (or uploading a PRD). We'll generate your Plan Pack in a few minutes. After that, open the project's Hand off tab and paste the command into Claude Code to start building.",
      },
    ],
  },
  {
    label: "Plans & billing",
    items: [
      {
        q: "What's the difference between Free, Core, and Pro?",
        a: "Free gives you 1 project (which you can't delete) and no Pilot. Core is $8/mo and gives you up to 8 projects, the ability to delete and recreate projects, and unlimited Plan Packs. Pro is $17/mo and includes everything in Core plus Pilot. Pay yearly and Core saves you 25%, Pro saves you 30%.",
      },
      {
        q: "How do I get a 2nd free project?",
        a: "Free includes one project to start. You can unlock a second free project by adding your WhatsApp number and a short intro about what you're building, with your consent. If you'd rather not, upgrading to Core lifts the limit to 8 projects right away.",
      },
      {
        q: "Why can't I delete my project on Free?",
        a: 'This keeps "1 free project" actually meaning one project — otherwise it would be unlimited projects, one at a time. Upgrade to Core whenever you want to delete and recreate projects freely, or to run several at once.',
      },
      {
        q: "How do I manage or cancel my subscription?",
        a: "Go to Settings → Manage billing. That opens the Stripe customer portal, where you can update your card, switch between monthly and yearly, download invoices, or cancel. Changes take effect according to your current billing period.",
      },
      {
        q: "Do you charge for AI tokens?",
        a: "No. You bring your own Claude Code, so all the AI usage that builds your app is billed through your own subscription — never by us. OnlyAIApp only charges the flat plan price (Free, Core, or Pro); we never add token or usage fees on top.",
      },
      {
        q: "What happens to my projects if I downgrade?",
        a: "Your projects, repos, and data stay where they are — they live in your own GitHub, Supabase, and Vercel accounts, so nothing is deleted when your plan changes. On Free you'll just be limited to the Free features again, like not being able to delete and recreate projects. Upgrade any time to unlock them.",
      },
    ],
  },
  {
    label: "Connecting services",
    items: [
      {
        q: "What is Supabase / Vercel / GitHub?",
        a: "GitHub is where your app's code lives. Supabase is your app's database plus its login system. Vercel is the hosting that puts your app online at a real link. Want the friendly, analogy-by-analogy version? See the Basics 101 tab.",
      },
      {
        q: "Do I need to pay for Supabase?",
        a: "Not to start. Supabase's free tier allows 2 active projects, which is plenty for your first apps. If you go beyond that you'll need Supabase Pro — but only once you actually hit the limit, not before.",
      },
      {
        q: "How do I connect Vercel / Supabase / Resend?",
        a: "Go to Settings and connect each service once. After that, every new project you provision reuses the same connection automatically — you won't have to reconnect for each app. Resend is optional and only needed if your app sends email.",
      },
      {
        q: "Do I have to connect everything before I can start?",
        a: "GitHub is required because that's how you sign in and where your code lives. Vercel and Supabase get wired up when you provision, and Resend is only needed if your app sends emails. Connect what you need now — you can always add the rest from Settings later.",
      },
    ],
  },
  {
    label: "Building & handoff",
    items: [
      {
        q: "How do I hand my project to Claude Code?",
        a: "Open the project's Hand off tab and copy the one-paste command. Run it in Claude Code and it does everything for you: clones your repo, sets your git identity so deploys work, and launches the agent with your Plan Pack loaded. From there you just talk to your AI and watch it build.",
      },
      {
        q: 'My deploy was blocked: "commit email could not be matched to a GitHub account."',
        a: "Vercel requires the commit author's email to be one that's on your GitHub account. New projects set this automatically, so this usually only happens on a repo you cloned before that fix. To resolve it, run: git config user.email \"<id>+<login>@users.noreply.github.com\", then commit and push again.",
      },
      {
        q: "My app built but the buttons don't do anything / it's just a dashboard.",
        a: "That means the AI built the shell but stopped before wiring up the core action. Tell your AI to keep building until the main thing your app does works end-to-end, not just the screens around it. New Plan Packs now require the core engine to work from the very start, so this happens far less on fresh projects.",
      },
      {
        q: "How long does building take?",
        a: "The Plan Pack generates in just a few minutes after you describe your idea. The actual build then happens across the sprints in your plan as your AI works through them. Smaller apps come together quickly; bigger ones take more sprints — but you can use what's built at each step.",
      },
      {
        q: "Can I change my idea after the plan is written?",
        a: "Yes. Just tell your AI coder what you want to change and it'll adjust the build. If it's a big shift in direction, you can generate a fresh Plan Pack (unlimited on Core and Pro) so the PRD, architecture, and sprints all line up with the new plan.",
      },
      {
        q: "Do I keep ownership of my app and code?",
        a: "Completely. Everything lives in your own GitHub repo, your Supabase database, and your Vercel hosting under your accounts. OnlyAIApp sets it up and writes the plan, but the code and data are yours to keep, move, or take elsewhere at any time.",
      },
    ],
  },
  {
    label: "Pilot (Pro)",
    items: [
      {
        q: "What is Pilot?",
        a: "Pilot is your co-pilot for live apps. It watches deploy health and detects drift across all your projects, auto-captures what changed, and runs launch-readiness checks so you know an app is actually ready before you share it. It's a Pro feature.",
      },
      {
        q: "Why is Pilot paid?",
        a: "Pilot runs AI on our side, continuously, to watch your builds and catch problems for you. That ongoing AI work has a real cost, which is why it lives on the Pro plan rather than being free for everyone.",
      },
    ],
  },
  {
    label: "Inspiration & directory",
    items: [
      {
        q: "What is the Inspiration page?",
        a: "Inspiration is a directory that automatically showcases live, deployed apps built on OnlyAIApp. It's a great place to see what others have shipped and spark ideas for your own projects. Your live apps can appear there too once they're deployed.",
      },
      {
        q: "How does my app get featured?",
        a: "The Inspiration page auto-showcases apps that are live and deployed, so the main thing is to get your project shipped on Vercel. Keep building until your core feature works end-to-end, deploy it, and it becomes eligible to appear among the live examples.",
      },
    ],
  },
  {
    label: "Account & privacy",
    items: [
      {
        q: "What data do you collect?",
        a: "We collect your GitHub email and username so you can sign in and we can connect your projects. If you choose to unlock a second free project, we also store the WhatsApp number and short intro you give us — only with your consent. For the full details, see the Privacy Policy.",
      },
      {
        q: "Is my WhatsApp number required?",
        a: "No. It's only used if you opt in to unlock a second free project by sharing a short intro about what you're building. If you'd rather not share it, you can simply upgrade to Core instead, which lifts the project limit without any of that.",
      },
      {
        q: "How do I get help from a human?",
        a: "Email us at xienpuo@onlyaiwork.com and a real person will help. We're happy to walk you through provisioning, handoff, billing, or anything that's not clicking — just describe what you're seeing and we'll take it from there.",
      },
      {
        q: "I'm stuck mid-build — what should I do first?",
        a: "Start by checking the project's Hand off tab to confirm you ran the one-paste command correctly. Many issues — like a blocked deploy or unwired buttons — have a specific answer above, so scan this page first. If you're still stuck, email xienpuo@onlyaiwork.com and we'll help.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-10">
      <header className="space-y-3">
        <Link
          href="/dashboard"
          className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          ← Dashboard
        </Link>
        <p className="eyebrow">Help</p>
        <h1 className="text-3xl font-bold font-display tracking-tight text-on-surface">
          Help & FAQ
        </h1>
        <p className="text-on-surface-variant">
          Quick answers to the questions people ask most while turning an idea into a real, working app.
        </p>
        <p className="text-sm text-on-surface-variant rounded-lg bg-surface-dim border border-outline-variant px-3.5 py-2.5">
          Core &amp; Pro members can also chat with our AI assistant for instant help (coming to this page).
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.label} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            {section.label}
          </h2>
          <div className="space-y-2.5">
            {section.items.map((item) => (
              <details key={item.q} className="panel group p-0">
                <summary className="flex cursor-pointer items-start gap-2.5 px-4 py-3.5 font-display font-medium text-on-surface marker:content-['']">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 text-brand transition-transform duration-150 group-open:rotate-90"
                  >
                    ▸
                  </span>
                  <span>{item.q}</span>
                </summary>
                <p className="px-4 pb-4 pl-[2.6rem] text-on-surface-variant leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <footer className="border-t border-outline-variant pt-6 text-sm text-on-surface-variant">
        Still stuck? Email{" "}
        <a
          href="mailto:xienpuo@onlyaiwork.com"
          className="text-brand hover:text-brand-dim transition-colors"
        >
          xienpuo@onlyaiwork.com
        </a>{" "}
        and a human will help.
      </footer>
    </main>
  );
}
