"use client";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="btn-ghost text-xs px-3 py-2 transition-colors whitespace-nowrap active:scale-95"
    >
      {label}
    </button>
  );
}
