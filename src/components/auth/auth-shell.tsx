import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/server/auth/session";

const COPY = {
  login: { title: "Welcome back", subtitle: "Sign in to your personal research digest." },
  register: { title: "Create your InsightLoop", subtitle: "Pick your topics, connect Telegram, get one smart digest a day." },
};

export function AuthCardSkeleton() {
  return <div className="mx-auto mt-10 h-[520px] max-w-4xl animate-pulse rounded-3xl border border-line bg-panel/60" />;
}

export async function AuthCard({ mode, searchParams }: { mode: "login" | "register"; searchParams: Promise<{ next?: string | string[] }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const copy = COPY[mode];

  return (
    <div className="mx-auto mt-6 grid max-w-4xl overflow-hidden rounded-3xl border border-line bg-panel/80 fade-up md:grid-cols-2">
      <div className="p-6 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
        <div className="mt-8">
          <AuthForm mode={mode} next={typeof next === "string" ? next : undefined} />
        </div>
      </div>
      <div className="dusk relative hidden min-h-full flex-col justify-end p-10 md:flex">
        <p className="text-xl font-semibold">Stay informed. Stay ahead.</p>
        <p className="mt-2 text-sm text-white/80">
          RSS from the sources you trust, scored and summarized by AI, delivered to Telegram every morning.
        </p>
      </div>
    </div>
  );
}
