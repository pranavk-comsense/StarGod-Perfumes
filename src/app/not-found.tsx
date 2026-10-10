import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <p className="mt-12 font-heading text-8xl font-semibold italic text-gold">404</p>
      <h1 className="mt-2 text-3xl">This page has evaporated</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className={buttonVariants()}>
          Go home
        </Link>
        <Link href="/shop" className={buttonVariants({ variant: "outline" })}>
          Shop fragrances
        </Link>
      </div>
    </main>
  );
}
