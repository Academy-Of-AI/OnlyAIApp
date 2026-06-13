/**
 * Upload an image via our own API route, which does the Supabase Storage write
 * SERVER-side. The browser storage SDK could stall indefinitely on session/auth
 * attach (seen as "Saving…" forever); going through the server avoids that, and
 * the AbortController guarantees it can never hang — it fails with a clear
 * message instead.
 */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(blob);
  });
}

/** Shared POST to /api/upload-image. One source for the timeout/abort logic. */
async function postUpload(
  blob: Blob,
  prefix: string,
  target?: "feedback",
): Promise<{ url?: string; path?: string }> {
  const dataUrl = await blobToDataUrl(blob);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, prefix, ...(target ? { target } : {}) }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; path?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Upload failed.");
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Upload timed out — please try again.");
    }
    throw e instanceof Error ? e : new Error("Upload failed.");
  } finally {
    clearTimeout(timer);
  }
}

/** Public image (avatar, showcase thumbnail). Returns the public URL. */
export async function uploadImage(blob: Blob, prefix: string): Promise<string> {
  const { url } = await postUpload(blob, prefix);
  if (!url) throw new Error("Upload failed.");
  return url;
}

/**
 * Bug-report screenshot → the PRIVATE `feedback` bucket. Returns the storage
 * PATH, not a URL — the image is unreachable by URL; the owner and Pilot read
 * it via a service-role signed link. The path is the durable diagnostic record.
 */
export async function uploadFeedbackScreenshot(blob: Blob): Promise<string> {
  const { path } = await postUpload(blob, "feedback", "feedback");
  if (!path) throw new Error("Upload failed.");
  return path;
}
