import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** GET /api/hackathons — list organizer's hackathons */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("hackathons")
    .select(`*, hackathon_participants(count)`)
    .eq("organizer_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}

/** POST /api/hackathons — create a hackathon (Org plan required) */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Org plan gate
  const { data: profile } = await supabase
    .from("profiles").select("plan").eq("id", user.id).single();
  if (profile?.plan !== "org") {
    return NextResponse.json(
      { error: "Hackathon mode requires the Org plan ($99/mo)." },
      { status: 403 },
    );
  }

  const body = await request.json() as {
    name: string;
    description?: string;
    maxParticipants?: number;
    templateId?: string;
    startsAt?: string;
    endsAt?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hackathons")
    .insert({
      organizer_id: user.id,
      name: body.name,
      description: body.description,
      max_participants: body.maxParticipants ?? 200,
      template_id: body.templateId ?? "vibe-stack-supabase",
      starts_at: body.startsAt,
      ends_at: body.endsAt,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("events").insert({
    user_id: user.id,
    event: "hackathon_created",
    properties: { hackathonId: data.id, name: body.name },
  });

  return NextResponse.json(data, { status: 201 });
}
