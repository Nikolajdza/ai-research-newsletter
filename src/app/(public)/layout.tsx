import Link from "next/link";
import { Brand } from "@/components/shell/brand";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Brand />
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/discover" className="rounded-xl px-2.5 py-2 text-muted hover:text-foreground sm:px-3">
            Discover
          </Link>
          <Link href="/how-it-works" className="hidden rounded-xl px-3 py-2 text-muted hover:text-foreground sm:block">
            How it works
          </Link>
          <Link href="/login" className="rounded-xl px-3 py-2 text-muted hover:text-foreground">
            Sign in
          </Link>
          <Link href="/register" className="rounded-xl bg-accent px-3.5 py-2 font-medium text-white glow-accent">
            Get started
          </Link>
        </nav>
      </header>
      <main className="flex-1 px-5 pb-16">{children}</main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        InsightLoop · RSS → AI → your daily digest
      </footer>
    </div>
  );
}
