import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — OnlyAIApp",
  description:
    "How OnlyAIApp (by Academy of AI / AOAI) collects, uses, and protects your personal data, written to be PDPA (Singapore) and GDPR-aware.",
};

const subProcessors = [
  { name: "Supabase", role: "Database & authentication hosting" },
  { name: "Vercel", role: "Application hosting & deployment" },
  { name: "GitHub", role: "OAuth sign-in & code repository provisioning" },
  { name: "Stripe", role: "Payment processing" },
  { name: "Anthropic", role: "AI model provider (Claude) powering the build agent" },
  { name: "Resend", role: "Transactional & marketing email delivery" },
  { name: "PostHog", role: "Product analytics" },
];

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Back link */}
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Back to home
      </Link>

      {/* Header */}
      <header className="space-y-3">
        <p className="eyebrow">Legal</p>
        <h1 className="font-display tracking-tight text-on-surface text-3xl sm:text-4xl font-bold">
          Privacy Policy
        </h1>
        <p className="text-sm text-outline">Last updated: 4 June 2026</p>
        <p className="text-on-surface-variant leading-relaxed">
          This policy explains how OnlyAIApp handles your personal data. We have
          written it to be consistent with Singapore&apos;s Personal Data
          Protection Act (PDPA) and the EU/UK General Data Protection Regulation
          (GDPR), so you know what we collect, why, and what choices you have.
        </p>
      </header>

      {/* Who we are */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          1. Who we are
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          OnlyAIApp is a product operated by Academy of AI (&ldquo;AOAI&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). The service
          lets you build and deploy a real, working software system with the help
          of an AI agent. This policy covers our product available at{" "}
          <a
            href="https://onlyaiapp.com"
            className="text-brand hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            onlyaiapp.com
          </a>
          . For any privacy question, you can reach us at{" "}
          <a
            href="mailto:xienpuo@onlyaiwork.com"
            className="text-brand hover:underline"
          >
            xienpuo@onlyaiwork.com
          </a>
          .
        </p>
      </section>

      {/* What we collect */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          2. What data we collect
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          We aim to collect only what we need to give you a working product. The
          data we collect falls into these categories:
        </p>
        <ul className="space-y-2 text-on-surface-variant leading-relaxed list-disc pl-5">
          <li>
            <span className="font-semibold text-on-surface">
              GitHub account information.
            </span>{" "}
            When you sign in with GitHub (OAuth), we receive your email address
            and GitHub username, which we use to create and identify your
            account and to provision a repository for your project.
          </li>
          <li>
            <span className="font-semibold text-on-surface">
              Contact details you choose to add.
            </span>{" "}
            You may optionally provide a phone or WhatsApp number so we can reach
            you about your build. Providing this is entirely voluntary.
          </li>
          <li>
            <span className="font-semibold text-on-surface">
              A short profile you voluntarily provide.
            </span>{" "}
            You may optionally tell us your role, what you&apos;re building, your
            company size, and how you heard about us. This helps us tailor your
            experience and improve the product. It is never required to use the
            service.
          </li>
          <li>
            <span className="font-semibold text-on-surface">
              Usage and analytics data.
            </span>{" "}
            We collect information about how you interact with the product (pages
            visited, features used, and similar events) to understand usage and
            improve the service.
          </li>
          <li>
            <span className="font-semibold text-on-surface">
              Payment information.
            </span>{" "}
            If you make a payment, your card and billing details are collected
            and processed directly by Stripe, our payment processor. We do not
            store your full card number on our servers.
          </li>
        </ul>
      </section>

      {/* How we use it */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          3. How we use your data
        </h2>
        <ul className="space-y-2 text-on-surface-variant leading-relaxed list-disc pl-5">
          <li>
            To run the service — authenticate you, create your account, and let
            you build with the AI agent.
          </li>
          <li>
            To provision and operate the infrastructure for your project
            (database, hosting, and code repository).
          </li>
          <li>
            To provide customer support and respond to your questions, including
            via the phone or WhatsApp number you choose to share.
          </li>
          <li>
            To understand product usage and improve features, reliability, and
            security.
          </li>
          <li>
            To send you product updates and marketing —{" "}
            <span className="font-semibold text-on-surface">
              only where you have given consent
            </span>
            . You can withdraw that consent at any time (see Section 5).
          </li>
        </ul>
      </section>

      {/* Legal bases */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          4. Legal bases for processing (GDPR)
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          If you are in the EU or UK, we rely on the following legal bases under
          the GDPR:
        </p>
        <ul className="space-y-2 text-on-surface-variant leading-relaxed list-disc pl-5">
          <li>
            <span className="font-semibold text-on-surface">Contract.</span>{" "}
            Processing necessary to provide the service you signed up for —
            creating your account and provisioning your project.
          </li>
          <li>
            <span className="font-semibold text-on-surface">
              Legitimate interest.
            </span>{" "}
            Processing to operate, secure, and improve our product, where this is
            not overridden by your rights and freedoms.
          </li>
          <li>
            <span className="font-semibold text-on-surface">Consent.</span>{" "}
            Processing for marketing communications and any optional information
            you choose to share. You can withdraw consent at any time.
          </li>
        </ul>
        <p className="text-on-surface-variant leading-relaxed">
          Under Singapore&apos;s PDPA, we collect, use, and disclose personal
          data with your consent (including deemed consent where applicable) or
          as otherwise permitted by law.
        </p>
      </section>

      {/* Marketing & consent */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          5. Marketing &amp; consent
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          We only send marketing and non-essential product updates if you have
          opted in. Opting in is your choice and is never a condition of using
          the service.
        </p>
        <p className="text-on-surface-variant leading-relaxed">
          You can withdraw your consent and unsubscribe at any time by clicking
          the unsubscribe link in any marketing email, or by emailing us at{" "}
          <a
            href="mailto:xienpuo@onlyaiwork.com"
            className="text-brand hover:underline"
          >
            xienpuo@onlyaiwork.com
          </a>
          . Withdrawing consent for marketing does not affect essential,
          service-related messages (for example, security or billing notices).
        </p>
      </section>

      {/* Sharing / sub-processors */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          6. Who we share data with (sub-processors)
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          We do not sell your personal data. We share data only with trusted
          service providers (sub-processors) who help us run the product, and
          only as needed for them to perform their service. Our key
          sub-processors are:
        </p>
        <ul className="space-y-2 text-on-surface-variant leading-relaxed">
          {subProcessors.map((p) => (
            <li key={p.name} className="flex flex-col sm:flex-row sm:gap-2">
              <span className="font-semibold text-on-surface sm:min-w-[7rem]">
                {p.name}
              </span>
              <span>{p.role}</span>
            </li>
          ))}
        </ul>
        <p className="text-on-surface-variant leading-relaxed">
          These providers process data under their own privacy and security
          commitments. We may also disclose data where required by law or to
          protect our rights, users, or the public.
        </p>
      </section>

      {/* Data retention */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          7. Data retention
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          We keep your personal data only for as long as we need it for the
          purposes described in this policy — typically while you have an active
          account, and for a reasonable period afterwards to meet legal,
          accounting, or security obligations. When data is no longer needed, we
          delete or anonymise it. You can ask us to delete your data sooner (see
          Section 8).
        </p>
      </section>

      {/* Your rights */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          8. Your rights
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          Depending on where you live, you have rights over your personal data
          under the PDPA and/or the GDPR, including the right to:
        </p>
        <ul className="space-y-2 text-on-surface-variant leading-relaxed list-disc pl-5">
          <li>
            <span className="font-semibold text-on-surface">Access</span> the
            personal data we hold about you.
          </li>
          <li>
            <span className="font-semibold text-on-surface">
              Correct
            </span>{" "}
            inaccurate or incomplete data.
          </li>
          <li>
            <span className="font-semibold text-on-surface">Delete</span> your
            data, where applicable.
          </li>
          <li>
            <span className="font-semibold text-on-surface">
              Withdraw consent
            </span>{" "}
            at any time, where we rely on consent.
          </li>
          <li>
            <span className="font-semibold text-on-surface">
              Data portability
            </span>{" "}
            — receive a copy of your data in a portable format.
          </li>
        </ul>
        <p className="text-on-surface-variant leading-relaxed">
          To exercise any of these rights, email us at{" "}
          <a
            href="mailto:xienpuo@onlyaiwork.com"
            className="text-brand hover:underline"
          >
            xienpuo@onlyaiwork.com
          </a>
          . We will respond within the timeframes required by applicable law. If
          you are in the EU/UK, you also have the right to lodge a complaint with
          your local data protection authority.
        </p>
      </section>

      {/* International transfers */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          9. International data transfers
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          We and our sub-processors may store and process data in countries
          outside your own, including the United States. Where we transfer
          personal data across borders, we take steps to ensure it remains
          protected — for example, relying on recognised safeguards such as the
          EU Standard Contractual Clauses, and meeting the transfer requirements
          of the PDPA so your data receives a comparable standard of protection.
        </p>
      </section>

      {/* Cookies */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          10. Cookies &amp; similar technologies
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          We use cookies and similar technologies to keep you signed in, remember
          your preferences, and understand how the product is used (analytics).
          You can control cookies through your browser settings; disabling some
          cookies may affect how the service works.
        </p>
      </section>

      {/* Children */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          11. Children
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          OnlyAIApp is not intended for children. The service is not directed to
          anyone under 16 (or under 18 where local law sets a higher age), and we
          do not knowingly collect personal data from them. If you believe a
          child has provided us with personal data, please contact us so we can
          delete it.
        </p>
      </section>

      {/* Changes */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          12. Changes to this policy
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          We may update this policy from time to time. When we make material
          changes, we will update the &ldquo;Last updated&rdquo; date above and,
          where appropriate, notify you. We encourage you to review this page
          periodically.
        </p>
      </section>

      {/* Contact / DPO */}
      <section className="panel p-5 sm:p-6 space-y-3">
        <h2 className="font-display text-on-surface text-lg font-semibold">
          13. How to contact us
        </h2>
        <p className="text-on-surface-variant leading-relaxed">
          For any questions about this policy or your personal data — or to reach
          our Data Protection Officer — email us at{" "}
          <a
            href="mailto:xienpuo@onlyaiwork.com"
            className="text-brand hover:underline"
          >
            xienpuo@onlyaiwork.com
          </a>
          . We are committed to resolving any concerns you may have about how we
          use your data.
        </p>
      </section>

      {/* Disclaimer */}
      <section className="space-y-2 pt-2">
        <p className="text-xs text-outline leading-relaxed">
          Disclaimer: This privacy policy is a general template provided for
          convenience and does not constitute legal advice. It should be reviewed
          and adapted by qualified legal counsel to fit your specific
          circumstances and obligations before you rely on it.
        </p>
        <p className="text-xs text-outline">
          OnlyAIApp — an Academy of AI (AOAI) product.
        </p>
      </section>
    </main>
  );
}
