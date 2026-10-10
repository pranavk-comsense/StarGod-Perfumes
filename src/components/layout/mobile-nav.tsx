"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navCategories } from "@/lib/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Open menu" className="flex size-10 items-center justify-center rounded-md hover:bg-white/10 lg:hidden">
        <MenuIcon className="size-5" strokeWidth={1.5} />
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-sm">
        <SheetHeader>
          <SheetTitle className="font-brand text-2xl font-extrabold text-primary">StarGod</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col px-4 pb-6" aria-label="Mobile">
          {navCategories.map((c) => (
            <Link key={c.slug} href={`/shop?category=${c.slug}`} onClick={close} className="border-b py-3.5">
              <span className="block text-sm uppercase tracking-[0.15em]">{c.label}</span>
              <span className="text-xs text-muted-foreground">{c.blurb}</span>
            </Link>
          ))}
          <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
            <Link href="/account" onClick={close}>My account</Link>
            <Link href="/account/orders" onClick={close}>Track an order</Link>
            <Link href="/contact" onClick={close}>Contact us</Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
