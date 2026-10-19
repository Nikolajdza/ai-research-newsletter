import { Suspense } from "react";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar, SidebarProfile } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar
          profile={
            <Suspense fallback={<div className="h-12" />}>
              <SidebarProfile />
            </Suspense>
          }
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
        </div>
      </div>
      <MobileNav />
    </>
  );
}
