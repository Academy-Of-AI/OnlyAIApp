/**
 * The canonical "How it works" journey — ONE source of truth so the first-login
 * popup (components/how-it-works-modal.tsx) and the /guide page tell the exact
 * same story. Change it here and both surfaces update.
 */
export type HowItWorksStep = {
  icon: string;
  title: string;
  body: string;
  href?: string;
  cta?: string;
};

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    icon: "🧭",
    title: "Pick what to build",
    body: "Choose a track or describe your own idea in a sentence.",
    href: "/tracks",
    cta: "Pick a track",
  },
  {
    icon: "📋",
    title: "We plan it & wire it up",
    body: "You get a clear, sequenced plan — and your GitHub repo, database & hosting set up for you.",
  },
  {
    icon: "🤖",
    title: "Build with your AI agent",
    body: "Hand off to Claude Code or Codex. The plan is baked in, so your agent knows exactly what to build.",
  },
  {
    icon: "🚀",
    title: "Ship it & show your proof",
    body: "Deploy a real, live app you own — then show it on your portfolio & the showcase.",
    href: "/portfolio",
    cta: "Open Portfolio",
  },
];
