"use client";

import { useState } from "react";
import { uploadImage } from "@/lib/upload-image";
import { CopyLinkButton } from "@/components/portfolio-tools";
import { AvatarCropper } from "@/components/avatar-cropper";

type Initial = {
  avatar_url: string | null;
  display_name: string | null;
  headline: string | null;
  linkedin_url: string | null;
  website_url: string | null;
};

export function ProfileCard({
  githubUsername, email, shipped, building, initial,
}: {
  githubUsername: string | null;
  email: string | null;
  shipped: number;
  building: number;
  initial: Initial;
}) {
  const fallbackName = githubUsername || email?.split("@")[0] || "Builder";
  const [avatar, setAvatar] = useState(initial.avatar_url);
  const [name, setName] = useState(initial.display_name ?? "");
  const [headline, setHeadline] = useState(initial.headline ?? "");
  const [linkedin, setLinkedin] = useState(initial.linkedin_url ?? "");
  const [website, setWebsite] = useState(initial.website_url ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  const shownName = name.trim() || fallbackName;
  const initials = shownName.slice(0, 2).toUpperCase();
  const autoLine = `AI builder — ${shipped} app${shipped === 1 ? "" : "s"} shipped${building ? `, ${building} building` : ""}`;

  // Pick a file → open the cropper (don't upload the raw file).
  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (file) { setMsg(null); setCropFile(file); }
  }

  // Cropper returns a square blob → upload SERVER-side (reliable, can't hang) + save.
  async function uploadCropped(blob: Blob) {
    setUploading(true); setMsg(null);
    try {
      const url = await uploadImage(blob, "avatar");
      const res = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar_url: url }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg({ text: d.error ?? "Couldn't save photo." }); return; }
      setAvatar(url); setMsg({ ok: true, text: "Photo updated." }); setCropFile(null);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Upload failed — try again." });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name, headline, linkedin_url: linkedin, website_url: website }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ text: d.error ?? "Couldn't save." }); return; }
      setMsg({ ok: true, text: "Saved ✓" }); setEditing(false);
    } catch {
      setMsg({ text: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-4 sm:p-[18px]">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Avatar — click to upload */}
        <label className="relative shrink-0 cursor-pointer group" title="Change photo">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={shownName} className="rounded-xl object-cover" style={{ width: 52, height: 52 }} />
          ) : (
            <span className="rounded-xl grid place-items-center text-white text-lg font-bold" style={{ background: "linear-gradient(135deg, var(--color-brand), #d946ef)", width: 52, height: 52 }}>{initials}</span>
          )}
          <span className="absolute inset-0 rounded-xl bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-white text-[10px] font-semibold">
            {uploading ? "…" : "Photo"}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={onPhoto} disabled={uploading} />
        </label>

        <div className="flex-1 min-w-[160px]">
          <p className="font-display font-semibold text-lg text-on-surface">{shownName}</p>
          <p className="text-sm text-on-surface-variant">{headline.trim() || autoLine}</p>
          {(linkedin || website) && (
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {linkedin && <a href={linkedin} target="_blank" rel="noopener noreferrer" className="chip chip-neutral hover:border-outline">in · LinkedIn</a>}
              {website && <a href={website} target="_blank" rel="noopener noreferrer" className="chip chip-neutral hover:border-outline">🔗 Website</a>}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {githubUsername && <CopyLinkButton username={githubUsername} />}
          {githubUsername && <a href={`/u/${githubUsername}`} target="_blank" rel="noopener noreferrer" className="btn-brand text-sm px-3 py-1.5">View public ↗</a>}
          <button onClick={() => setEditing((v) => !v)} className="btn-ghost text-sm px-3 py-1.5">{editing ? "Close" : "Edit profile"}</button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 pt-4 border-t border-outline-variant space-y-2.5">
          <div className="grid sm:grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-xs text-on-surface-variant">Display name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={fallbackName} className="cap-input mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-on-surface-variant">Headline</span>
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Marketer turned AI builder" className="cap-input mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-on-surface-variant">LinkedIn</span>
              <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/you" className="cap-input mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-on-surface-variant">Website (optional)</span>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yoursite.com" className="cap-input mt-1" />
            </label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={save} disabled={busy} className="btn-brand text-sm px-4 py-1.5">{busy ? "Saving…" : "Save profile"}</button>
            {msg && <span className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
          </div>
          <p className="text-[11px] text-outline">Your photo, name &amp; links appear on your public profile — make it yours. 🪄</p>
        </div>
      )}
      {!editing && msg && <p className={`text-xs mt-2 ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}

      {cropFile && (
        <AvatarCropper file={cropFile} busy={uploading} onCancel={() => setCropFile(null)} onCropped={uploadCropped} />
      )}
    </div>
  );
}
