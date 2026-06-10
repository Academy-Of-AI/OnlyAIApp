import { signInWithGitHub, signInWithEmail } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Only honor same-origin, local-path redirects (defense against open redirect).
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string; sent?: string; email_error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params?.next);
  // Already signed in (e.g. opened the app in a new tab)? Don't make them
  // re-authenticate — send them straight to where they were headed.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(next);

  const authError = params?.auth_error;
  const emailError = params?.email_error === "1";
  const sent = params?.sent;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-surface">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-brand">OnlyAIApp · Build Studio</p>
          <h1 className="font-display text-2xl font-bold text-on-surface">Build real apps. Own the proof.</h1>
          <p className="text-on-surface-variant text-sm">Sign in to start — no setup, no config.</p>
        </div>

        {authError && (
          <div className="bg-[rgba(220,38,38,.08)] border border-[rgba(220,38,38,.25)] text-danger text-xs px-3 py-2 rounded-lg break-words">
            {authError}
          </div>
        )}

        {emailError && (
          <div className="bg-warn/10 border border-warn/30 text-warn text-xs px-3 py-2.5 rounded-lg leading-relaxed">
            📭 Couldn’t email a sign-in link just now — please try again in a moment.
          </div>
        )}

        {sent ? (
          <div className="panel p-6 text-center space-y-2">
            <p className="text-3xl">📧</p>
            <p className="font-display font-semibold text-on-surface">Check your email</p>
            <p className="text-sm text-on-surface-variant">We sent a sign-in link to <b className="text-on-surface">{sent}</b>. Click it to continue.</p>
            <a href={next === "/dashboard" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`} className="inline-block text-xs text-brand-dim hover:underline pt-1">Use a different method</a>
          </div>
        ) : (
          <>
            {/* Email magic link — gets you in without GitHub */}
            <form action={signInWithEmail} className="space-y-2">
              <input type="hidden" name="next" value={next} />
              <input name="email" type="email" required placeholder="you@email.com" className="cap-input" />
              <button type="submit" className="btn-brand w-full py-2.5 text-sm">Email me a sign-in link →</button>
            </form>

            <div className="flex items-center gap-3 text-xs text-outline">
              <span className="h-px flex-1 bg-outline-variant" /> or <span className="h-px flex-1 bg-outline-variant" />
            </div>

            {/* GitHub — also signs you in, and grants repo access for building.
                NOT auto-recommended on email failure: pushing a half-signed-up
                user here can mint a SECOND account and trigger the "GitHub already
                linked" lockout. Let them retry email; offer GitHub neutrally. */}
            <form action={signInWithGitHub}>
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="w-full flex items-center justify-center gap-2.5 py-2.5 text-sm btn-ghost">
                <GitHubIcon />
                Continue with GitHub
              </button>
            </form>

            <p className="text-center text-xs text-on-surface-variant leading-relaxed">
              Continuing with GitHub lets us create your app’s code repo <b>in your own account</b> —
              that’s how the app becomes truly yours. We only ever touch repos we create for you.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58v-2.03c-3.34.72-4.04-1.6-4.04-1.6-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
