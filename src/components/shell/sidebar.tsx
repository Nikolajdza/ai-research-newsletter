import { connection } from "next/server";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";
import { getPreferences } from "@/server/queries";
import { Brand } from "./brand";
import { SidebarLinks } from "./nav-links";

export function Sidebar({ profile }: { profile: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-panel/60 px-4 py-6 backdrop-blur lg:flex">
      <div className="px-2">
        <Brand />
      </div>
      <div className="mt-8 flex-1">
        <SidebarLinks />
      </div>
      {profile}
    </aside>
  );
}

export async function SidebarProfile() {
  await connection();
  const prefs = await getPreferences();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent/80 to-accent-2/80 text-xs font-semibold">
        {initials(prefs.displayName)}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium">{prefs.displayName}</p>
        <p className="truncate text-xs text-muted">Local workspace</p>
      </div>
    </div>
  );
}
