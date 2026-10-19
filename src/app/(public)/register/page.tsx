import { Suspense } from "react";
import { AuthCard, AuthCardSkeleton } from "@/components/auth/auth-shell";

export const metadata = { title: "Create account" };

export default function RegisterPage(props: PageProps<"/register">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AuthCard mode="register" searchParams={props.searchParams} />
    </Suspense>
  );
}
