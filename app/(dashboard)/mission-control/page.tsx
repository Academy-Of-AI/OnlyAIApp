import { redirect } from "next/navigation";

// Mission Control was folded into the top-level Pilot tab.
export default function MissionControlPage() {
  redirect("/pilot");
}
