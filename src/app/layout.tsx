import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar, SidebarProfile } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { appConfig } from "@/lib/config";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${appConfig.name} — ${appConfig.tagline}`, template: `%s · ${appConfig.name}` },
  description: "Multi-topic RSS research, scored by AI, delivered as a daily digest.",
};

export const viewport: Viewport = {
  themeColor: "#080a14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
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
      </body>
    </html>
  );
}
