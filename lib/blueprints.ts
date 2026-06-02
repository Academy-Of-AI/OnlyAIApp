/**
 * Definition-of-Done items per blueprint — the explicit "am I done?" certainty
 * list a member ticks before a build is eligible for The Wall.
 *
 * v1: a sensible default that fits any blueprint. Real per-blueprint lists ship
 * with the blueprint library (BY_TEMPLATE overrides).
 */

export interface DodItem {
  key: string;
  label: string;
}

const DEFAULT_DOD: DodItem[] = [
  { key: "core", label: "The one core thing works end-to-end" },
  { key: "data", label: "Real data saves to the database — nothing hardcoded" },
  { key: "auth", label: "A new person can sign up and actually use it" },
  { key: "mobile", label: "It looks intentional on phone and desktop" },
  { key: "demo", label: "I recorded a 60-second demo" },
];

const BY_TEMPLATE: Record<string, DodItem[]> = {
  // Per-blueprint overrides land here when the blueprint library is authored,
  // e.g. "lead-qualifier": [{ key: "scoring", label: "Leads are scored automatically" }, ...]
};

export function getDodItems(templateId?: string | null): DodItem[] {
  return (templateId && BY_TEMPLATE[templateId]) || DEFAULT_DOD;
}
