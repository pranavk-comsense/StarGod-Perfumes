import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MailCheckIcon } from "lucide-react";
import { ResendVerificationForm } from "@/components/auth/auth-forms";
import { emailSchema } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  return (
    <div className="text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent">
        <MailCheckIcon className="size-6 text-gold" />
      </span>
      <h1 className="mt-6 text-4xl">Check your inbox</h1>
      <Suspense>
        <VerifyContent searchParams={searchParams} />
      </Suspense>
      <p className="mt-8 text-sm text-muted-foreground">
        Already confirmed?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

async function VerifyContent({ searchParams }: Pick<PageProps<"/verify-email">, "searchParams">) {
  const parsed = emailSchema.safeParse((await searchParams).email);
  const email = parsed.success ? parsed.data : null;
  return (
    <>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We&apos;ve sent a confirmation link to {email ? <span className="font-medium text-foreground">{email}</span> : "your email"}. Click it
        to activate your account. The link expires in 1 hour.
      </p>
      {email && (
        <div className="mt-8 text-left">
          <ResendVerificationForm email={email} />
        </div>
      )}
    </>
  );
}
