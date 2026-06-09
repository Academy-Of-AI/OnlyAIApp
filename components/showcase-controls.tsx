"use client";

import { useState } from "react";
import { uploadImage } from "@/lib/upload-image";

export function ShowcaseControls({
  projectId, published, image,
}: {
  projectId: string; published: boolean; image: string | null;
}) {
  const [pub, setPub] = useState(published);
  const [img, setImg] = useState<string | null>(image);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function patch(body: Record<string, unknown>) {
    return fetch(`/api/projects/${projectId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  }

  async function savePublished(next: boolean) {
    setPub(next); setMsg(null);
    await patch({ showcase_published: next }).catch(() => {});
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const url = await uploadImage(file, projectId);
      await patch({ showcase_image: url });
      setImg(url); setMsg("Thumbnail updated.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function clearImage() {
    setImg(null); setMsg(null);
    await patch({ showcase_image: null }).catch(() => {});
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-sm text-on-surface">Publish to the public Showcase</span>
        <input type="checkbox" checked={pub} onChange={(e) => savePublished(e.target.checked)} className="w-4 h-4 accent-[var(--color-brand)]" />
      </label>

      <div className="flex items-center gap-3 flex-wrap">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="thumbnail" className="w-24 h-16 object-cover rounded-lg border border-outline-variant" />
        ) : (
          <div className="w-24 h-16 rounded-lg border border-dashed border-outline-variant grid place-items-center text-[10px] text-outline">auto shot</div>
        )}
        <div className="flex flex-col gap-1">
          <label className="btn-ghost text-xs px-3 py-1.5 cursor-pointer inline-flex w-fit">
            {busy ? "Uploading…" : "Upload thumbnail"}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
          </label>
          {img && <button onClick={clearImage} className="text-[11px] text-on-surface-variant hover:underline text-left">Use auto screenshot</button>}
        </div>
      </div>

      {msg && <p className="text-xs text-on-surface-variant">{msg}</p>}
      <p className="text-[11px] text-outline">Only published apps appear on the Showcase. Upload a thumbnail if the auto-screenshot shows a login page or an unfinished screen.</p>
    </div>
  );
}
