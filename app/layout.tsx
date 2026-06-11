import { PHProvider } from "@/components/posthog-provider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://onlyaiapp.com"),
  title: {
    default: "OnlyAIApp — Build your first real app with AI",
    template: "%s · OnlyAIApp",
  },
  description:
    "OnlyAIApp is the on-ramp to building real software with AI. Describe what you want — your AI agent builds it on a reliable foundation and ships it live. No setup, no code required.",
  applicationName: "OnlyAIApp",
  keywords: [
    "AI app builder",
    "build an app with AI",
    "no-code AI app",
    "Claude Code for beginners",
    "ship a real app",
    "vibe coding",
  ],
  openGraph: {
    type: "website",
    url: "https://onlyaiapp.com",
    siteName: "OnlyAIApp",
    title: "OnlyAIApp — Build your first real app with AI",
    description:
      "Describe what you want — your AI agent builds it on a reliable foundation and ships it live. The on-ramp to building real software with AI.",
  },
  twitter: {
    card: "summary_large_image",
    title: "OnlyAIApp — Build your first real app with AI",
    description:
      "Describe what you want — your AI agent builds it and ships it live. No setup, no code required.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (password managers, dark-mode,
    // Grammarly, the QA's automation extension, etc.) inject attributes/nodes into
    // <html>/<body> BEFORE React hydrates, which trips a #418 hydration mismatch
    // and forces a full client re-render (the flicker). This scopes the tolerance
    // to the document shell only — real mismatches in the app tree still surface.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased bg-[var(--color-surface)] text-[var(--color-on-surface)]">
          <PHProvider>{children}</PHProvider>
        </body>
    </html>
  );
}
