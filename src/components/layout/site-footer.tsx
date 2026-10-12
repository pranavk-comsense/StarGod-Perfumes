import Link from "next/link";
import { ClockIcon, MailIcon, MapPinIcon, MessageCircleIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { footerLinks, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-secondary/60">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-[1.3fr_1fr_1fr_1fr] md:gap-10 md:py-12">
        <div className="col-span-2 space-y-3.5 md:col-span-1">
          <Logo size="sm" className="items-start" />
          <p className="max-w-[17rem] text-[13px] leading-snug text-muted-foreground">
            Long-lasting eau de parfums, inspired by the world&apos;s most loved scents.
          </p>
          <ul className="space-y-1.5 text-[13px] leading-snug text-muted-foreground">
            <li className="flex gap-2">
              <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
              <a href={site.store.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                Shop No. 5, Pinnacle Prestige, Tilak Rd,
                <br />
                Sadashiv Peth, Pune 411030
              </a>
            </li>
            <li className="flex items-center gap-2">
              <ClockIcon className="size-3.5 shrink-0" /> Open daily, 10 AM – 11 PM
            </li>
          </ul>
          <div className="flex items-center gap-2 pt-0.5">
            {[
              { href: `https://wa.me/${site.whatsapp}`, label: `WhatsApp ${site.supportPhone}`, icon: <MessageCircleIcon className="size-4" /> },
              { href: `mailto:${site.supportEmail}`, label: `Email ${site.supportEmail}`, icon: <MailIcon className="size-4" /> },
              { href: site.instagram.url, label: `Instagram ${site.instagram.handle}`, icon: <InstagramGlyph /> },
            ].map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                aria-label={c.label}
                title={c.label}
                className="flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                {c.icon}
              </a>
            ))}
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-[13px] text-muted-foreground hover:text-foreground">
              {site.supportPhone}
            </a>
          </div>
        </div>
        {Object.entries(footerLinks).map(([title, links]) => (
          <div key={title}>
            <h2 className="eyebrow mb-3 font-sans text-foreground md:mb-4">{title}</h2>
            <ul className="space-y-2 text-[13px] text-muted-foreground md:space-y-2.5 md:text-sm">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 pb-24 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:py-5">
          <p>
            © {site.name} · A brand of {site.legalName}. All rights reserved.
          </p>
          <p>Secure payments: UPI · Cards · Net banking · Wallets · Cash on Delivery</p>
        </div>
      </div>
    </footer>
  );
}

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  );
}
