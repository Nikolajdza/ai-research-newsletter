import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { appConfig } from "@/lib/config";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const siteUrl = appConfig.urls.app;
const description =
  "Multi-topic RSS research, scored by AI once, delivered as a personal daily Telegram digest.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${appConfig.name} — ${appConfig.tagline}`, template: `%s · ${appConfig.name}` },
  description,
  openGraph: {
    title: `${appConfig.name} — ${appConfig.tagline}`,
    description,
    url: siteUrl,
    siteName: appConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${appConfig.name} — ${appConfig.tagline}`,
    description,
  },
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
