import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/auth-actions";
import { initials } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
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
  const user = await requireUser();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/80 to-accent-2/80 text-xs font-semibold">
        {initials(user.displayName)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{user.displayName}</p>
        <p className="truncate text-xs text-muted">{user.role === "admin" ? "Admin" : user.email}</p>
      </div>
      <form action={logoutAction}>
        <button aria-label="Sign out" title="Sign out" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/[0.05] hover:text-foreground">
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
