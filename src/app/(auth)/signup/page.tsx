import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Divider, GoogleButton, SignupForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <>
      <h1 className="text-4xl">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">Faster checkout, order tracking and members-only offers.</p>
      <div className="mt-8">
        <Suspense>
          <SignupContent searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function SignupContent({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const next = safeNext((await searchParams).next) ?? undefined;
  return (
    <>
      <GoogleButton next={next} />
      <Divider />
      <SignupForm next={next} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
