import { ScopeForm } from "@/components/scope-form";

export default function ScopePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Start here — scope your OS</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Tell me the messy, repetitive thing you want handled. Answer a few questions and we&apos;ll
          narrow it to a buildable v1 — then turn it into your project.
        </p>
      </div>
      <ScopeForm />
    </main>
  );
}
