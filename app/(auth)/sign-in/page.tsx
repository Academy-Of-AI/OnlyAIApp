import { signInWithGitHub } from "./actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const params = await searchParams;
  const authError = params?.auth_error;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-surface">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="eyebrow text-sm tracking-wide uppercase text-xs">OnlyAIApp</p>
          <h1 className="font-display text-2xl font-bold text-on-surface">Build your AI system</h1>
          <p className="text-on-surface-variant text-sm">
            Sign in or create an account — your workspace is tied to your GitHub.
          </p>
        </div>

        {authError && (
          <div className="bg-[rgba(220,38,38,.08)] border border-[rgba(220,38,38,.25)] text-danger text-xs px-3 py-2 rounded-lg break-words">
            {authError}
          </div>
        )}

        {/* Primary CTA — server action, works without JS */}
        <form action={signInWithGitHub}>
          <button
            type="submit"
            className="btn-brand w-full flex items-center justify-center gap-2.5 py-3 text-sm"
          >
            <GitHubIcon />
            Continue with GitHub
          </button>
        </form>

        {/* Fix 5: product-specific rationale */}
        <p className="text-center text-xs text-on-surface-variant leading-relaxed">
          GitHub is required — your app, repo, and workflow live in real code.
          We create your workspace and keep your build on track from there.
        </p>

        {/* Fix 3: trust / legal microcopy — no Terms/Privacy pages exist yet, so safe copy only */}
        <p className="text-center text-[11px] text-outline">
          By continuing you agree that OnlyAIApp may access your GitHub account to
          create and manage repositories on your behalf.
        </p>
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
