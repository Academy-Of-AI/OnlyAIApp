import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * GET /api/cron/directory-health  (Vercel Cron, daily)
 * Pings every Directory entry's live URL and flips status live/down so dead or
 * broken apps drop off the showcase automatically. No-ops cleanly until the
 * wall_submissions migration (live_url/status/last_checked) is applied.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createAdminClient();

  let rows: Array<{ id: string; live_url: string | null; demo_url: string | null }> = [];
  try {
    const { data, error } = await admin
      .from("wall_submissions")
      .select("id, live_url, demo_url")
      .limit(500);
    if (error) throw error;
    rows = (data as typeof rows | null) ?? [];
  } catch {
    return NextResponse.json({ ok: true, skipped: "migration not applied" });
  }

  let checked = 0, live = 0, down = 0;
  for (const r of rows) {
    const url = r.live_url || r.demo_url;
    if (!url) continue;
    checked++;
    let ok = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
      clearTimeout(t);
      ok = res.status < 500 && res.status !== 404;
    } catch { ok = false; }
    ok ? live++ : down++;
    try {
      await admin.from("wall_submissions")
        .update({ status: ok ? "live" : "down", last_checked: new Date().toISOString() })
        .eq("id", r.id);
    } catch { /* columns may not exist; ignore */ }
  }

  return NextResponse.json({ ok: true, checked, live, down });
}
