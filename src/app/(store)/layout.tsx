import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { StoreJsonLd } from "@/components/store/visit-store";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <WhatsAppButton />
      <StoreJsonLd />
    </CartProvider>
  );
}
