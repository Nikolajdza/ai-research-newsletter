"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_TOPICS } from "@/lib/topics";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { preferences, users } from "@/server/db/schema";

export type AuthFormState = { error?: string; email?: string; displayName?: string } | undefined;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

const registerSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(40, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const echo = { email: String(formData.get("email") ?? ""), displayName: String(formData.get("displayName") ?? "") };
  if (!parsed.success) return { ...echo, error: parsed.error.issues[0]?.message };

  const { displayName, email, password } = parsed.data;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { ...echo, error: "An account with this email already exists" };

  const isFirstUser = (await db.$count(users)) === 0;
  const [user] = await db
    .insert(users)
    .values({ email, displayName, passwordHash: await hashPassword(password), role: isFirstUser ? "admin" : "member" })
    .returning({ id: users.id });

  await db.insert(preferences).values({
    userId: user.id,
    selectedTopics: [...DEFAULT_TOPICS],
    // Single-user installs configured a chat in .env before accounts existed; hand it to the owner.
    telegramChatId: isFirstUser ? process.env.TELEGRAM_CHAT_ID?.trim() || null : null,
  });

  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { email, error: "Wrong email or password" };
  }

  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
