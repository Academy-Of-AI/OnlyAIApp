/**
 * Server-side PostHog event tracking.
 * Non-fatal — analytics errors never break the app.
 *
 * Key funnel events:
 *   github_connected, vercel_connected, project_provisioned,
 *   hackathon_created, hackathon_joined, plan_upgraded
 */
export async function track(
  event: string,
  userId: string,
  properties?: Record<string, unknown>,
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"}/capture/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event,
          distinct_id: userId,
          properties: { ...properties, $lib: "server" },
          timestamp: new Date().toISOString(),
        }),
      },
    );
  } catch {
    // Intentionally silent
  }
}
