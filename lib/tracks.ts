/**
 * Outcome-mapped build tracks. Each ends with a real, deployed artifact the user owns.
 * Shared by /tracks (display) and the new-build seeding flow (Phase 2).
 */
export type Track = {
  key: string;
  icon: string;
  title: string;
  desc: string;
  ship: string;      // the finished artifact
  time: string;
  difficulty: "Beginner" | "Intermediate";
  why: string;
  /** Seed brief handed to the scope → Plan Pack flow. */
  seed: string;
};

export const TRACKS: Track[] = [
  {
    key: "role",
    icon: "💼",
    title: "Land your next role",
    desc: "Build a standout portfolio project that proves you can ship with AI.",
    ship: "a live app + a case study",
    time: "~1 day",
    difficulty: "Beginner",
    why: "real proof beats a résumé line",
    seed: "A polished portfolio web app that demonstrates real product thinking and shipping ability, suitable to show employers.",
  },
  {
    key: "income",
    icon: "💰",
    title: "A small money-maker",
    desc: "Ship a tiny paid tool — a micro-SaaS you can actually charge for.",
    ship: "a deployed tool with checkout",
    time: "~2 days",
    difficulty: "Intermediate",
    why: "side income, fully owned",
    seed: "A small paid micro-SaaS tool that solves one specific problem and can take payment for access.",
  },
  {
    key: "busywork",
    icon: "⚙️",
    title: "Kill your busywork",
    desc: "Automate a workflow you hate into an internal tool for you or your team.",
    ship: "a working internal tool",
    time: "~1 day",
    difficulty: "Beginner",
    why: "hours back every week",
    seed: "An internal tool that automates a repetitive manual workflow for a small team.",
  },
  {
    key: "mvp",
    icon: "🚀",
    title: "Validate a business idea",
    desc: "Turn an idea into a real MVP people can use this week.",
    ship: "a usable MVP + signups",
    time: "~3 days",
    difficulty: "Intermediate",
    why: "test demand for real",
    seed: "A minimum viable product for a new business idea that real users can sign up for and use.",
  },
  {
    key: "brand",
    icon: "✍️",
    title: "Grow your personal brand",
    desc: "Build your own site or content tool — stop renting someone else’s platform.",
    ship: "a live site/tool you own",
    time: "~1 day",
    difficulty: "Beginner",
    why: "own your audience",
    seed: "A personal site or content tool the owner fully controls, for growing an audience.",
  },
  {
    key: "explore",
    icon: "🧪",
    title: "Just explore",
    desc: "No goal yet? Spin up a sandbox and build whatever you’re curious about.",
    ship: "a deployed experiment",
    time: "~30 min",
    difficulty: "Beginner",
    why: "fun first → proof follows",
    seed: "A small experimental app to explore an idea quickly and learn by building.",
  },
];

export function getTrack(key?: string | null): Track | undefined {
  return TRACKS.find((t) => t.key === key);
}
