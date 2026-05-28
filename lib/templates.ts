/**
 * Template registry. Each entry maps a template id to the GitHub repo that
 * provisioning generates from. Add entries here as new starter templates land
 * (they must be GitHub "template repositories").
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  owner: string;
  repo: string;
  tags: string[];
  recommended?: boolean;
}

export const TEMPLATES: Template[] = [
  {
    id: "vibe-stack-supabase",
    name: "Vibe Stack (Supabase)",
    description: "Next.js + TypeScript + Tailwind + Supabase auth/db + Stripe. The full SaaS starter.",
    owner: process.env.GITHUB_TEMPLATE_OWNER ?? "xp-luffy",
    repo: "vibe-stack-supabase",
    tags: ["Next.js", "Supabase", "Stripe", "SaaS"],
    recommended: true,
  },
];

export function getTemplate(id: string | undefined): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
