/**
 * Outcome-mapped build tracks. Each ends with a real, deployed artifact the user owns.
 * - prefill: starter values that populate the scope form (a tailored on-ramp).
 * - modifier: extra build guidance appended to the brief. It FLAVORS the build
 *   (audience/shape) but never replaces the underlying generation method.
 */
export type ScopeField = "problem" | "who" | "things" | "workflow" | "success" | "notV1";

export type Track = {
  key: string;
  icon: string;
  title: string;
  desc: string;
  ship: string;
  time: string;
  difficulty: "Beginner" | "Intermediate";
  why: string;
  prefill: Partial<Record<ScopeField, string>>;
  modifier: string;
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
    modifier: "Optimize for a polished, demoable portfolio piece a recruiter can try in 30 seconds — first impression and clarity matter.",
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
    modifier: "Include a simple paid tier with checkout so the tool can charge for access from day one.",
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
    modifier: "Optimize for automating one repetitive workflow into a fast, no-friction internal tool.",
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
    modifier: "Keep it a lean MVP: signups plus the single core action, nothing extra — built to test demand fast.",
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
    modifier: "Optimize for a personal site / content tool the owner fully controls, with easy publishing.",
  },
  {
    key: "team",
    icon: "🏢",
    title: "A system for your team",
    desc: "Build an internal operational tool for your department — sales, ops, HR, finance.",
    ship: "a shared internal system",
    time: "~3 days",
    difficulty: "Intermediate",
    why: "your team runs on it",
    prefill: {
      problem: "An internal operational system for my department’s recurring workflow.",
      who: "My team / department",
      things: "The records, statuses, and people my team tracks today in spreadsheets/chat.",
      workflow: "A team member logs the work and everyone sees the shared, up-to-date view.",
      success: "My team runs the real workflow here instead of spreadsheets.",
    },
    modifier: "This is a multi-user internal team tool: design for shared data across several users with clear roles, an operational dashboard, and reliability for daily use.",
  },
];

export function getTrack(key?: string | null): Track | undefined {
  return TRACKS.find((t) => t.key === key);
}
