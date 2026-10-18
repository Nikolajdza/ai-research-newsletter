import { Bell, Search, Workflow } from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/70 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <Brand compact />
        </div>
        <form action="/articles" className="relative hidden flex-1 sm:block lg:max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            placeholder="Search articles, topics, or keywords..."
            className="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          />
        </form>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/articles"
            aria-label="Search"
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel text-muted sm:hidden"
          >
            <Search className="h-[18px] w-[18px]" />
          </Link>
          <Link
            href="/newsletter"
            aria-label="Newsletter"
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel text-muted transition-colors hover:text-foreground"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500" />
          </Link>
          <Link
            href="/workflow"
            aria-label="Workflow"
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel text-muted transition-colors hover:text-foreground"
          >
            <Workflow className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </div>
    </header>
  );
}
