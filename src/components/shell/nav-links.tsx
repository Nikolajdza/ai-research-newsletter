"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { isActive, MOBILE_NAV_ITEMS, NAV_ITEMS } from "./nav-items";

function SidebarList({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-accent/15 font-medium text-foreground ring-1 ring-accent/30"
                : "text-muted hover:bg-white/[0.04] hover:text-foreground"
            }`}
          >
            <Icon className={`h-[18px] w-[18px] ${active ? "text-accent" : ""}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileList({ pathname }: { pathname: string | null }) {
  return (
    <div className="grid grid-cols-5">
      {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 py-2 text-[11px] ${
              active ? "text-foreground" : "text-muted"
            }`}
          >
            <span
              className={`grid h-8 w-12 place-items-center rounded-xl ${active ? "bg-accent/20 text-accent" : ""}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function ActiveSidebarList() {
  return <SidebarList pathname={usePathname()} />;
}

function ActiveMobileList() {
  return <MobileList pathname={usePathname()} />;
}

export function SidebarLinks() {
  return (
    <Suspense fallback={<SidebarList pathname={null} />}>
      <ActiveSidebarList />
    </Suspense>
  );
}

export function MobileLinks() {
  return (
    <Suspense fallback={<MobileList pathname={null} />}>
      <ActiveMobileList />
    </Suspense>
  );
}
