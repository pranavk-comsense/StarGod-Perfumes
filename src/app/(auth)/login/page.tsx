import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Divider, GoogleButton, LoginForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-4xl">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to track orders, save addresses and check out faster.</p>
      <div className="mt-8">
        <Suspense>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const next = safeNext((await searchParams).next) ?? undefined;
  return (
    <>
      <GoogleButton next={next} />
      <Divider />
      <LoginForm next={next} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to StarGod?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </>
  );
}
