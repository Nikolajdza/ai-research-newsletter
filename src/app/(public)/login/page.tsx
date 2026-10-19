import { Suspense } from "react";
import { AuthCard, AuthCardSkeleton } from "@/components/auth/auth-shell";

export const metadata = { title: "Sign in" };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AuthCard mode="login" searchParams={props.searchParams} />
    </Suspense>
  );
}
