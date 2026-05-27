"use client";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors whitespace-nowrap active:scale-95"
    >
      {label}
    </button>
  );
}
