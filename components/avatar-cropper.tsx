"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const SIZE = 256; // square export + on-screen frame (1:1 — WYSIWYG)

/**
 * Square avatar cropper. Drag to reposition, slider to zoom, then exports a
 * perfectly square image so it never gets head-cropped on display.
 */
export function AvatarCropper({
  file, onCancel, onCropped, busy = false,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  busy?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [url, setUrl] = useState<string>("");
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  // Load the picked file into an object URL.
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const coverScale = nat ? Math.max(SIZE / nat.w, SIZE / nat.h) : 1;
  const drawScale = coverScale * zoom;
  const drawnW = nat ? nat.w * drawScale : SIZE;
  const drawnH = nat ? nat.h * drawScale : SIZE;
  const maxX = Math.max(0, (drawnW - SIZE) / 2);
  const maxY = Math.max(0, (drawnH - SIZE) / 2);

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }),
    [maxX, maxY],
  );

  // Re-clamp when zoom changes.
  useEffect(() => { setOff((o) => clamp(o.x, o.y)); }, [zoom, clamp]);

  const left = SIZE / 2 - drawnW / 2 + off.x;
  const top = SIZE / 2 - drawnH / 2 + off.y;

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.sx);
    const ny = drag.current.oy + (e.clientY - drag.current.sy);
    setOff(clamp(nx, ny));
  }
  function onPointerUp() { drag.current = null; }

  function save() {
    const img = imgRef.current;
    if (!img || !nat) return;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, left, top, drawnW, drawnH);
    canvas.toBlob((blob) => { if (blob) onCropped(blob); }, "image/jpeg", 0.9);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="panel p-5 w-full max-w-[320px] space-y-4">
        <div>
          <p className="font-display font-semibold text-on-surface">Frame your photo</p>
          <p className="text-xs text-on-surface-variant mt-0.5">Drag to move · slide to zoom.</p>
        </div>

        <div
          className="relative mx-auto rounded-2xl overflow-hidden border border-outline-variant bg-surface-high cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={url}
              alt="crop"
              draggable={false}
              onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={{ position: "absolute", left, top, width: drawnW, height: drawnH, maxWidth: "none" }}
            />
          )}
          {/* circular guide */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0)" }} aria-hidden />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-[var(--color-brand)]" />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="btn-ghost text-sm px-3 py-1.5">Cancel</button>
          <button onClick={save} disabled={busy || !nat} className="btn-brand text-sm px-4 py-1.5">{busy ? "Saving…" : "Save photo"}</button>
        </div>
      </div>
    </div>
  );
}
