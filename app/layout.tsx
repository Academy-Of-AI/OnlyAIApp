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
    <html lang="en">
      <body className="antialiased bg-neutral-950 text-white">
          <PHProvider>{children}</PHProvider>
        </body>
    </html>
  );
}
