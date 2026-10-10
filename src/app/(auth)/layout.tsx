import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary-deep via-primary to-primary-deep text-white lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,color-mix(in_oklch,var(--lilac)_35%,transparent),transparent_60%)]" />
        <Image src="/brand/emblem-white.png" alt="" width={584} height={784} unoptimized priority className="relative h-72 w-auto" />
        <p className="relative mt-8 font-brand text-6xl font-extrabold tracking-tight">StarGod</p>
        <p className="relative mt-2 font-brand text-lg font-bold uppercase tracking-[0.25em] text-lilac">Premium Perfumes</p>
        <p className="relative mt-10 max-w-sm text-center text-sm text-white/70">
          24 hour long lasting perfumes · Buy 1 Get 1 Free · 1500+ international fragrances at our Pune store
        </p>
      </aside>
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="size-4" /> Back to store
          </Link>
          <Logo className="lg:hidden" size="sm" />
          <span className="w-24 lg:hidden" aria-hidden />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
