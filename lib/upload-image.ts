/**
 * Upload an image (avatar, showcase thumbnail) via our own API route, which
 * does the Supabase Storage write SERVER-side. The browser storage SDK could
 * stall indefinitely on session/auth attach (seen as "Saving…" forever); going
 * through the server avoids that, and the AbortController guarantees it can
 * never hang — it fails with a clear message instead.
 *
 * Returns the public URL of the uploaded image.
 */
export async function uploadImage(blob: Blob, prefix: string): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(blob);
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, prefix }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed.");
    return data.url;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Upload timed out — please try again.");
    }
    throw e instanceof Error ? e : new Error("Upload failed.");
  } finally {
    clearTimeout(timer);
  }
}
