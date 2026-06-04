import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/profile/optin — save the user's contact + short intro (with consent).
 * Granting the free bonus project is derived from (marketing_consent && phone).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string; consent?: boolean;
    role?: string; building?: string; companySize?: string; source?: string;
  };
  const phone = (body.phone ?? "").trim();
  if (!phone) return NextResponse.json({ error: "Add your phone / WhatsApp number." }, { status: 400 });
  if (!body.consent) return NextResponse.json({ error: "Please tick the consent box to continue." }, { status: 400 });

  const { error } = await supabase.from("profiles").update({
    phone,
    marketing_consent: true,
    consent_at: new Date().toISOString(),
    profile_role: (body.role ?? "").trim() || null,
    profile_building: (body.building ?? "").trim() || null,
    profile_company_size: (body.companySize ?? "").trim() || null,
    profile_source: (body.source ?? "").trim() || null,
  }).eq("id", user.id);
  if (error) {
    console.error("[profile/optin]", error);
    return NextResponse.json({ error: "Couldn't save — please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
