"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, type AuthFormState } from "@/app/auth-actions";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-background/60 px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/20";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? loginAction : registerAction,
    undefined,
  );
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {isRegister && (
        <label className="block text-xs text-muted">
          Name
          <input name="displayName" defaultValue={state?.displayName} required maxLength={40} autoComplete="name" className={inputClass} placeholder="Nikola" />
        </label>
      )}
      <label className="block text-xs text-muted">
        Email
        <input name="email" type="email" defaultValue={state?.email} required autoComplete="email" className={inputClass} placeholder="you@example.com" />
      </label>
      <label className="block text-xs text-muted">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={isRegister ? 8 : undefined}
          autoComplete={isRegister ? "new-password" : "current-password"}
          className={inputClass}
          placeholder={isRegister ? "At least 8 characters" : "••••••••"}
        />
      </label>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-400/20">
          {state.error}
        </p>
      )}

      <button
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white glow-accent disabled:opacity-70"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isRegister ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-xs text-muted">
        {isRegister ? "Already have an account? " : "New to InsightLoop? "}
        <Link href={isRegister ? "/login" : "/register"} className="text-accent hover:underline">
          {isRegister ? "Sign in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}
