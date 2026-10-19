import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
