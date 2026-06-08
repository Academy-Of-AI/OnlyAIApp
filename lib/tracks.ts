/**
 * Outcome-mapped build tracks. Each ends with a real, deployed artifact the user owns.
 * Shared by /tracks (display) and the scope → Plan Pack flow (each track prefills
 * the scope form distinctly, so picking a track is a tailored on-ramp).
 */
export type ScopeField = "problem" | "who" | "things" | "workflow" | "success" | "notV1";

export type Track = {
  key: string;
  icon: string;
  title: string;
  desc: string;
  ship: string;      // the finished artifact
  time: string;
  difficulty: "Beginner" | "Intermediate";
  why: string;
  /** Per-track starter values that prefill the scope form (user edits to their specifics). */
  prefill: Partial<Record<ScopeField, string>>;
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
    prefill: {
      problem: "A standout portfolio project that proves I can ship a real, working app with AI.",
      workflow: "A visitor opens the live app and sees it working end-to-end.",
      success: "I have a deployed app + a short case study I can show employers.",
    },
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
    prefill: {
      problem: "A small paid tool that solves one specific problem people will pay for.",
      workflow: "A user signs up, uses the core feature, and pays for access.",
      success: "The tool is live and can take a real payment.",
    },
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
    prefill: {
      problem: "Automate a repetitive manual workflow I (or my team) do every week.",
      workflow: "I enter the inputs once and the tool produces the result automatically.",
      success: "The task that took hours now takes minutes.",
    },
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
    prefill: {
      problem: "An MVP for my business idea that real users can try this week.",
      workflow: "A new user signs up and completes the core action.",
      success: "Real people are signing up and using it.",
    },
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
    prefill: {
      problem: "My own site or content tool that I fully own (not a rented platform).",
      workflow: "I publish/manage my content and visitors can view it.",
      success: "It’s live on my own domain and I control it.",
    },
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
    prefill: {
      problem: "A small experiment to try an idea quickly and learn by building.",
      workflow: "The core idea works end-to-end, even if it’s rough.",
      success: "It’s deployed and I learned something.",
    },
  },
];

export function getTrack(key?: string | null): Track | undefined {
  return TRACKS.find((t) => t.key === key);
}
