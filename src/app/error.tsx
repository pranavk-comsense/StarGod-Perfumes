"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        We couldn&apos;t load this page. Please try again. If it keeps happening, contact our support team.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Go home
        </Link>
      </div>
    </main>
  );
}
