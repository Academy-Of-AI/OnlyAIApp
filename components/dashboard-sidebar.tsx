"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const WORKSPACE = [
  { href: "/scope", label: "Start here", icon: "✦" },
  { href: "/dashboard", label: "Projects", icon: "▦" },
  { href: "/pilot", label: "Pilot", icon: "🛫" },
  { href: "/directory", label: "Directory", icon: "🏛" },
];
const ACCOUNT = [
  { href: "/guide", label: "How it works", icon: "?" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ href, label, icon, pathname }: { href: string; label: string; icon: string; pathname: string }) {
  const active = isActive(pathname, href);
  return (
    <Link href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-violet-500/[0.12] text-white border border-violet-500/30"
          : "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
      }`}>
      <span className="text-[13px] w-4 text-center shrink-0">{icon}</span>
      {label}
    </Link>
  );
}

/** Desktop left rail. Hidden on mobile (mobile uses the horizontal row below). */
export function DashboardSidebar({ plan }: { plan: string }) {
  const pathname = usePathname() ?? "";
  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-white/10 fixed inset-y-0 left-0 bg-neutral-950 z-20">
      <Link href="/dashboard" className="font-bold text-sm px-5 h-14 flex items-center border-b border-white/10 hover:text-neutral-300 transition-colors shrink-0">
        OnlyAIApp
      </Link>

      <div className="px-3 pt-4">
        <Link href="/new-project"
          className="flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors">
          ＋ New project
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Workspace</p>
          {WORKSPACE.map((n) => <NavLink key={n.href} {...n} pathname={pathname} />)}
        </div>
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Account</p>
          {ACCOUNT.map((n) => <NavLink key={n.href} {...n} pathname={pathname} />)}
        </div>
      </nav>

      <div className="p-3 border-t border-white/10 space-y-2">
        {plan !== "pro" ? (
          <Link href="/upgrade"
            className="flex items-center justify-center gap-2 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
            ✨ Upgrade to Pro
          </Link>
        ) : (
          <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500">
            <span className="bg-white/10 text-white/60 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide">Pro</span>
            You&apos;re on Pro
          </div>
        )}
        <a href="mailto:xienpuo@onlyaiwork.com?subject=OnlyAIApp%20help"
          className="block text-center text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors">
          Need help?
        </a>
      </div>
    </aside>
  );
}

/** Mobile horizontal nav row (md:hidden). */
export function MobileNav() {
  const pathname = usePathname() ?? "";
  const all = [...WORKSPACE, ...ACCOUNT];
  return (
    <nav className="md:hidden flex gap-1 px-3 py-2 border-b border-white/10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link href="/new-project"
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap bg-violet-500 text-white font-semibold">
        ＋ New
      </Link>
      {all.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              active ? "bg-violet-500/[0.12] text-white" : "text-neutral-400 hover:text-white"
            }`}>
            <span>{n.icon}</span>{n.label}
          </Link>
        );
      })}
    </nav>
  );
}
