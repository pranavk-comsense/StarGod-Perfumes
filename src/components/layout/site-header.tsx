import Link from "next/link";
import { Suspense } from "react";
import { CartButton } from "@/components/cart/cart-button";
import { SearchDialog } from "@/components/layout/search-dialog";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AccountMenu, AccountMenuFallback } from "@/components/layout/account-menu";
import { categories, site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-[0_1px_0_rgb(0_0_0/0.08)]">
      <div className="bg-primary-deep px-4 py-2 text-center text-[11px] font-medium tracking-[0.12em] text-lilac">{site.announcement}</div>
      <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center lg:h-[84px]">
        <div className="flex items-center gap-1">
          <MobileNav />
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
            <Link href="/shop" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:text-lilac">
              Shop
            </Link>
            {categories.map((c) => (
              <Link key={c.slug} href={`/shop?category=${c.slug}`} className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:text-lilac">
                {c.label}
              </Link>
            ))}
          </nav>
        </div>

        <Logo tone="light" size="sm" className="lg:hidden" showTagline={false} />
        <Logo tone="light" className="hidden lg:inline-flex" />

        <div className="flex items-center justify-end gap-0.5">
          <SearchDialog />
          <Suspense fallback={<AccountMenuFallback />}>
            <AccountMenu />
          </Suspense>
          <CartButton />
        </div>
      </div>
    </header>
  );
}
