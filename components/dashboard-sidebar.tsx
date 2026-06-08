"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const ICON = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" strokeLinejoin="round" strokeLinecap="round" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2.2 5.3-5.3 2.2 2.2-5.3 5.3-2.2z" strokeLinejoin="round" /></>,
  pilot: <path d="M3 12l18-7-7 18-2.5-8L3 12z" strokeLinejoin="round" strokeLinecap="round" />,
  star: <path d="M12 3l2.09 5.26L20 9l-4 3.5L17 19l-5-3-5 3 1-6.5L3 9l5.91-.74z" strokeLinejoin="round" />,
  award: <><circle cx="12" cy="9" r="5" /><path d="M9 13.4L8 22l4-2.2L16 22l-1-8.6" strokeLinejoin="round" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8S11 3 8.5 3 6 5.5 8 8M12 8s1-5 3.5-5S18 5.5 16 8" strokeLinejoin="round" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 113.5 2.3c-.8.4-1 1-1 1.7M12 17h.01" strokeLinecap="round" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8M4.6 9a1.6 1.6 0 00-.3-1.8M9 4.6A1.6 1.6 0 0010.6 3M15 19.4a1.6 1.6 0 00-1.6 1.6M19.4 9a1.6 1.6 0 00.3-1.8M4.6 15a1.6 1.6 0 00-.3 1.8M9 19.4A1.6 1.6 0 0010.6 21M15 4.6A1.6 1.6 0 0013.4 3" strokeLinecap="round" /></>,
  book: <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" strokeLinejoin="round" />,
} as const;

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-[17px] h-[17px] shrink-0">
      {children}
    </svg>
  );
}

// Studio = where you build. Proof = what you walk away with.
const STUDIO: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: <Icon>{ICON.home}</Icon> },
  { href: "/projects", label: "Projects", icon: <Icon>{ICON.grid}</Icon> },
  { href: "/tracks", label: "Tracks", icon: <Icon>{ICON.compass}</Icon> },
  { href: "/pilot", label: "Pilot", icon: <Icon>{ICON.pilot}</Icon> },
];
const PROOF: NavItem[] = [
  { href: "/directory", label: "Showcase", icon: <Icon>{ICON.star}</Icon> },
  { href: "/portfolio", label: "Portfolio", icon: <Icon>{ICON.award}</Icon> },
];
const MORE: NavItem[] = [
  { href: "/guide", label: "How it works", icon: <Icon>{ICON.help}</Icon> },
  { href: "/basics", label: "Basics (101)", icon: <Icon>{ICON.book}</Icon> },
  { href: "/settings", label: "Settings", icon: <Icon>{ICON.gear}</Icon> },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function Logo() {
  return (
    <Link href="/dashboard" className="h-16 flex items-center gap-2.5 px-5 border-b border-[var(--color-sidebar-border)] hover:opacity-90 transition-opacity shrink-0">
      <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: "linear-gradient(135deg, var(--color-brand), #9333ea)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" className="w-4 h-4"><path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display font-bold text-[15px] text-[var(--color-sidebar-on)]">OnlyAIApp</span>
        <span className="text-[8.5px] font-bold tracking-[0.16em] uppercase text-[var(--color-brand)] mt-0.5">Build Studio</span>
      </span>
    </Link>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} className={`snav ${active ? "snav-active" : ""}`}>
      {item.icon}
      {item.label}
    </Link>
  );
}

/** Desktop left rail (dark). Hidden on mobile (mobile uses the horizontal row below). */
export function DashboardSidebar({
  plan = "free", username = "", signOut,
}: {
  plan?: string; username?: string; signOut?: () => void | Promise<void>;
}) {
  const pathname = usePathname() ?? "";
  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 fixed inset-y-0 left-0 z-20 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)]">
      <Logo />

      <div className="px-3 pt-4">
        <Link href="/tracks" className="btn-brand flex items-center justify-center gap-2 px-3 py-2.5 text-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          New build
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <div className="space-y-0.5">
          <p className="seclabel px-3 pb-1.5">Studio</p>
          {STUDIO.map((n) => <NavLink key={n.href} item={n} pathname={pathname} />)}
        </div>
        <div className="space-y-0.5">
          <p className="seclabel px-3 pb-1.5">Proof</p>
          {PROOF.map((n) => <NavLink key={n.href} item={n} pathname={pathname} />)}
        </div>
        <div className="space-y-0.5">
          <p className="seclabel px-3 pb-1.5">More</p>
          {MORE.map((n) => <NavLink key={n.href} item={n} pathname={pathname} />)}
        </div>
      </nav>

      <div className="p-3 border-t border-[var(--color-sidebar-border)] space-y-1">
        {plan !== "pro" && (
          <Link href="/upgrade"
            className="flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-opacity hover:opacity-90 mb-1"
            style={{ background: "color-mix(in srgb, var(--color-brand) 20%, transparent)", color: "#c4b5fd", border: "1px solid color-mix(in srgb, var(--color-brand) 38%, transparent)" }}>
            ✨ Upgrade{plan === "core" ? " to Pro" : ""}
          </Link>
        )}
        <Link href="/invite" className={`snav text-[13px] ${isActive(pathname, "/invite") ? "snav-active" : ""}`}>
          <Icon>{ICON.gift}</Icon>
          Invite &amp; earn
        </Link>
        <Link href="/help" className={`snav text-[13px] ${isActive(pathname, "/help") ? "snav-active" : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4 shrink-0"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinejoin="round" /></svg>
          Need help?
        </Link>

        {/* Account — avatar · name · plan (→ billing) · sign out (bottom, Claude-Code style) */}
        <div className="flex items-center gap-2.5 px-2 pt-2.5 mt-1.5 border-t border-[var(--color-sidebar-border)]">
          <Link href="/upgrade" title="Plan &amp; billing" className="flex items-center gap-2.5 min-w-0 flex-1 rounded-md hover:opacity-90 transition-opacity">
            <span className="w-7 h-7 rounded-full grid place-items-center text-white text-[11px] font-semibold shrink-0" style={{ background: "linear-gradient(135deg, var(--color-brand), #9333ea)" }}>
              {(username || "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-[13px] font-medium truncate" style={{ color: "var(--color-sidebar-on)" }}>{username || "Account"}</p>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--color-sidebar-on-variant)" }}>{plan} · billing</p>
            </div>
          </Link>
          {signOut && (
            <form action={signOut}>
              <button type="submit" title="Sign out" className="p-1 rounded-md hover:opacity-80 transition-opacity" style={{ color: "var(--color-sidebar-on-variant)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </form>
          )}
        </div>
      </div>
    </aside>
  );
}

/** Mobile horizontal nav row (md:hidden) — light, sits under the top bar. */
export function MobileNav() {
  const pathname = usePathname() ?? "";
  const all = [...STUDIO, ...PROOF, { href: "/invite", label: "Invite", icon: null }, ...MORE];
  return (
    <nav className="md:hidden flex gap-1 px-3 py-2 border-b border-[var(--color-outline-variant)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link href="/tracks" className="btn-brand flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0">
        ＋ New build
      </Link>
      {all.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
              active ? "bg-[var(--color-brand-container)] text-[var(--color-brand-dim)]" : "text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
            }`}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
