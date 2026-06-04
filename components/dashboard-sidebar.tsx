"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Projects", icon: "▦" },
  { href: "/directory", label: "Directory", icon: "🏛" },
  { href: "/mission-control", label: "Mission Control", icon: "🛰" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Desktop left rail. Hidden on mobile (mobile uses the horizontal row below). */
export function DashboardSidebar({ plan }: { plan: string }) {
  const pathname = usePathname() ?? "";
  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-white/10 fixed inset-y-0 left-0 bg-neutral-950 z-20">
      <Link href="/dashboard" className="font-bold text-sm px-5 h-14 flex items-center border-b border-white/10 hover:text-neutral-300 transition-colors">
        OnlyAIApp
      </Link>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-violet-500/[0.12] text-white border border-violet-500/30" : "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}>
              <span className="text-[13px] w-4 text-center shrink-0">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      {plan !== "pro" && (
        <div className="p-3 border-t border-white/10">
          <Link href="/upgrade"
            className="flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-400 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
            ✨ Upgrade to Pro
          </Link>
        </div>
      )}
    </aside>
  );
}

/** Mobile horizontal nav row (md:hidden). */
export function MobileNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="md:hidden flex gap-1 px-3 py-2 border-b border-white/10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {NAV.map((n) => {
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
