import { redirect } from "next/navigation";

/**
 * Pricing has been removed — OnlyAIApp is free (you bring your own Claude Code).
 * Kept as a redirect so any lingering /upgrade links land somewhere sensible.
 */
export default function UpgradePage() {
  redirect("/settings");
}
