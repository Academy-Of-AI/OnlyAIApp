"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      // Session recording (rrweb) runs a continuous DOM-mutation observer and a
      // steady upload stream — it keeps the page from ever reaching network-idle
      // (so automated screenshots time out ~30s while a human sees a working
      // page) and adds real main-thread cost on every navigation. Off by default
      // here; re-enable deliberately (e.g. sampled) if you want replay back.
      disable_session_recording: true,
    });
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
