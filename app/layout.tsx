import { PHProvider } from "@/components/posthog-provider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vibe Launchpad — Ship your app in 3 minutes",
  description:
    "Connect GitHub and Vercel, pick a stack, get a live app in under 3 minutes.",
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
