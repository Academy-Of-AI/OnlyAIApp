import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 30;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * POST /api/upload-image — upload an image to the public `showcase` bucket
 * SERVER-side (avatars, showcase thumbnails). The browser storage SDK could
 * stall on auth attach; doing the write here is reliable and bounded.
 *
 * Body: { dataUrl: "data:image/...;base64,...", prefix?: string }
 * Returns: { ok: true, url } — the public URL.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { dataUrl?: unknown; prefix?: unknown };
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";

  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return NextResponse.json({ error: "That doesn't look like an image." }, { status: 400 });

  const mime = match[1];
  const ext = MIME_EXT[mime] ?? "png";
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) return NextResponse.json({ error: "Empty image." }, { status: 400 });
  if (bytes.length > 6_000_000) return NextResponse.json({ error: "Image must be under 6MB." }, { status: 400 });

  const safePrefix = (typeof body.prefix === "string" ? body.prefix : "img").replace(/[^a-z0-9-]/gi, "").slice(0, 48) || "img";
  const path = `${user.id}/${safePrefix}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from("showcase").upload(path, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: "Upload failed: " + upErr.message }, { status: 400 });

  const url = supabase.storage.from("showcase").getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ ok: true, url });
}
