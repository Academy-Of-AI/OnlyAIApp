"use client";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SignInPage() {
  async function signInWithGitHub() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-neutral-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <Link href="/" className="text-white/50 text-sm hover:text-white">OnlyAIApp</Link>
          <h1 className="text-2xl font-bold text-white">Welcome</h1>
          <p className="text-neutral-500 text-sm">Sign in or create an account</p>
        </div>

        <button
          onClick={signInWithGitHub}
          className="w-full flex items-center justify-center gap-2 bg-white text-black font-medium py-3 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <GitHubIcon />
          Continue with GitHub
        </button>

        <p className="text-center text-xs text-neutral-600">
          GitHub is required to build — it&apos;s where your project lives.
        </p>
      </div>
    </main>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58v-2.03c-3.34.72-4.04-1.6-4.04-1.6-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
