/**
 * Map a raw provisioning error into one plain-English sentence a non-technical
 * builder can act on — never a raw JSON blob. The matched fix (e.g. the Vercel
 * GitHub-app install link) is included inline so it's actionable even as text.
 */
export function friendlyProvisionError(raw: string): string {
  const text = raw || "";
  const m = text.toLowerCase();

  // Vercel needs its GitHub App installed to link/create a project from a repo.
  // This is the #1 blocker: connecting Vercel via OAuth is not enough.
  if (/install the github integration|github app|apps\/vercel|to link a github repository/.test(m)) {
    return "Vercel needs access to your GitHub repos before it can deploy. Install the Vercel GitHub app (one click) at https://github.com/apps/vercel — grant it your repositories — then click Provision again.";
  }
  // Vercel token / permission problem.
  if (/forbidden|don't have permission|do not have permission|not authorized|invalid token|unauthorized/.test(m)) {
    return "Vercel wouldn't let us create the project — your Vercel connection is missing permissions or has expired. Reconnect Vercel and try again.";
  }
  // GitHub repo name already taken.
  if (/already exists|name already exists|must be unique/.test(m)) {
    return "A repo with this name already exists on your GitHub. Pick a different project name and try again.";
  }
  // Supabase organization at its project limit.
  if (/reached .*project limit|organization .*limit|project limit|free .*plan .*project/.test(m)) {
    return "Your Supabase organization is full — free orgs hold 2 databases. Free up a Supabase project (or upgrade), then try again.";
  }
  // AI usage / billing (rare in this path, but never dump it raw).
  if (/usage limit|x-api-key|anthropic|rate limit/.test(m)) {
    return "The AI service hit its usage limit. Please try again in a little while.";
  }
  // Fallback: a clean generic — the raw text stays in server logs for us.
  return "Something went wrong while setting up your project. Please try again in a moment — if it keeps failing, reconnect Vercel or Supabase and retry.";
}
