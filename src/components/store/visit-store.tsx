import { BuildingIcon, ClockIcon, MapPinIcon, NavigationIcon } from "lucide-react";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { StoreTourButton } from "@/components/store/store-tour";
import { site } from "@/lib/site";
import { cn } from "cn";

/** Photos from the StarGod Premium Perfumes Google listing (copied 13 Oct 2026). */
const STORE_PHOTOS = [
  { src: "/images/store/storefront.webp", alt: "StarGod Premium Perfumes storefront on Tilak Road, Pune" },
  { src: "/images/store/interior-arches.webp", alt: "Arched perfume shelves and gift hampers inside the store" },
  { src: "/images/store/shelf-arch.webp", alt: "Backlit arch shelf lined with StarGod perfume bottles" },
  { src: "/images/store/gift-pouches.webp", alt: "StarGod perfumes in satin gift pouches" },
];

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
              <BuildingIcon className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.5} />
              <span>
                {site.name}, a brand of <b className="font-semibold">{site.legalName}</b>
              </span>
            </li>
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
            <StoreTourButton />
          </div>
        </div>
        <div className="relative isolate min-h-96 overflow-hidden bg-primary text-primary-foreground">
          {STORE_PHOTOS.map((p, i) => (
            <Image
              key={p.src}
              src={p.src}
              alt={p.alt}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className={cn(
                "-z-20 object-cover opacity-0 motion-safe:animate-slide-fade",
                i === 0 && "motion-reduce:opacity-100",
              )}
              style={{ animationDelay: `${i * 5}s` }}
            />
          ))}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-primary-deep/90 via-primary-deep/30 to-transparent" />
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
    legalName: site.legalName,
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
