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
 * POST /api/upload-image — upload an image SERVER-side (the browser storage SDK
 * could stall on auth attach; doing the write here is reliable and bounded).
 *
 * Two targets share the same validation (single source of truth — don't fork it):
 *   • "showcase" (default) → PUBLIC bucket (avatars, thumbnails). Returns { url }.
 *   • "feedback"           → PRIVATE bucket (bug screenshots). Returns { path };
 *                            no public URL exists — the owner/Pilot read it via a
 *                            service-role signed URL. Owner-folder-scoped by RLS.
 *
 * Body: { dataUrl: "data:image/...;base64,...", prefix?: string, target?: "feedback" }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { dataUrl?: unknown; prefix?: unknown; target?: unknown };
  const target = body.target === "feedback" ? "feedback" : "showcase";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";

  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    // Distinguish an unsupported image type (e.g. iPhone HEIC) from non-image
    // junk so the user gets an actionable message instead of a generic one.
    const mimeMatch = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    if (mimeMatch) {
      return NextResponse.json(
        { error: `${mimeMatch[1]} images aren't supported — please use a JPG, PNG, WebP, or GIF.` },
        { status: 415 },
      );
    }
    return NextResponse.json({ error: "That doesn't look like an image." }, { status: 400 });
  }

  const mime = match[1];
  const ext = MIME_EXT[mime] ?? "png";
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) return NextResponse.json({ error: "Empty image." }, { status: 400 });
  if (bytes.length > 6_000_000) return NextResponse.json({ error: "Image must be under 6MB." }, { status: 400 });

  const safePrefix = (typeof body.prefix === "string" ? body.prefix : "img").replace(/[^a-z0-9-]/gi, "").slice(0, 48) || "img";
  const path = `${user.id}/${safePrefix}-${Date.now()}.${ext}`;

  // Feedback paths are unique (timestamped) → no upsert, so no UPDATE policy is
  // needed on the private bucket. Showcase keeps upsert (avatars overwrite).
  const { error: upErr } = await supabase.storage.from(target).upload(path, bytes, {
    contentType: mime,
    upsert: target === "showcase",
  });
  if (upErr) return NextResponse.json({ error: "Upload failed: " + upErr.message }, { status: 400 });

  // Private bucket: return the storage PATH (no public URL exists). The owner
  // and Pilot read it later with the service-role key.
  if (target === "feedback") return NextResponse.json({ ok: true, path });

  const url = supabase.storage.from(target).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ ok: true, url });
}
