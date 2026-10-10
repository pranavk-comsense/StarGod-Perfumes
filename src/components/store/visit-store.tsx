import { ClockIcon, MapPinIcon, MessageCircleIcon, NavigationIcon } from "lucide-react";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/lib/site";
import { cn } from "cn";

/** "Visit our store" block for the homepage and contact page. */
export function VisitStore({ className }: { className?: string }) {
  return (
    <section className={cn("container-page", className)} aria-labelledby="visit-heading">
      <div className="grid overflow-hidden rounded-md border bg-card md:grid-cols-2">
        <div className="p-8 sm:p-12">
          <p className="eyebrow text-gold">Visit us in Pune</p>
          <h2 id="visit-heading" className="mt-3 text-4xl">
            Try before you buy
          </h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Explore <b className="text-foreground">1500+ international fragrances</b> in person at our Sadashiv Peth store. Our team will help you find your signature.
          </p>
          <ul className="mt-6 grid gap-3 text-sm">
            <li className="flex gap-3">
              <MapPinIcon className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.5} />
              <address className="not-italic">
                {site.store.lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </address>
            </li>
            <li className="flex items-center gap-3">
              <ClockIcon className="size-5 shrink-0 text-gold" strokeWidth={1.5} /> {site.hours}
            </li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={site.store.mapsUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
              <NavigationIcon /> Get directions
            </a>
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
              <MessageCircleIcon /> WhatsApp us
            </a>
          </div>
        </div>
        <div className="relative min-h-64 bg-primary text-primary-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,var(--lilac),transparent_55%)] opacity-30" />
          <Image src="/brand/emblem-white.png" alt="" width={584} height={784} unoptimized aria-hidden className="absolute right-6 top-6 h-40 w-auto opacity-20" />
          <div className="relative flex h-full flex-col justify-end p-8 sm:p-12">
            <p className="font-heading text-5xl leading-none">Sadashiv Peth</p>
            <p className="mt-2 text-sm tracking-[0.3em] text-primary-foreground/70">PUNE · 411030</p>
            <p className="mt-6 text-sm text-primary-foreground/70">Near Pantancha Gate, Tilak Road</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** schema.org Store data so search engines can show address, hours and contacts. */
export function StoreJsonLd() {
  const url = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const data = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: site.store.name,
    url,
    email: site.supportEmail,
    telephone: site.supportPhone.replace(/\s/g, ""),
    address: {
      "@type": "PostalAddress",
      streetAddress: site.store.street,
      addressLocality: site.store.city,
      addressRegion: site.store.region,
      postalCode: site.store.postalCode,
      addressCountry: "IN",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: site.store.opens,
        closes: site.store.closes,
      },
    ],
    sameAs: [site.instagram.url],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
