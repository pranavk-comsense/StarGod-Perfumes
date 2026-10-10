export const site = {
  name: "StarGod Perfumes",
  tagline: "24 Hour Long Lasting Perfumes",
  supportEmail: "hello@thestargod.com",
  supportPhone: "+91 96696 61359",
  whatsapp: "919669661359",
  hours: "Open every day, 10:00 AM – 11:00 PM",
  instagram: { handle: "@stargodpremiumperfumes", url: "https://www.instagram.com/stargodpremiumperfumes/" },
  store: {
    name: "StarGod Perfumes",
    lines: ["Shop No. 5, Pinnacle Prestige", "Tilak Rd, Pantancha Gate", "Sadashiv Peth, Pune 411030"],
    street: "Shop No. 5, Pinnacle Prestige, Tilak Rd, Pantancha Gate, Sadashiv Peth",
    city: "Pune",
    region: "Maharashtra",
    postalCode: "411030",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=StarGod+Perfumes+Pinnacle+Prestige+Tilak+Road+Sadashiv+Peth+Pune+411030",
    opens: "10:00",
    closes: "23:00",
  },
  announcement: "24 Hour Long Lasting Perfumes · Buy 1 Get 1 Free · Free shipping · COD available",
};

export const categories = [
  { slug: "silver", label: "Silver", blurb: "₹1,455 · Buy 1 Get 1" },
  { slug: "golden", label: "Golden", blurb: "₹1,855 · Buy 1 Get 1" },
] as const;

/** Collections that run a Buy 1 Get 1 offer (mirrors collections.bogo). */
export const offerCollections = ["silver", "golden"] as const;

/** Header / mobile menu items. */
export const navCategories = categories;

export type CategorySlug = (typeof categories)[number]["slug"];

export const fragranceFamilies = ["Woody", "Floral", "Fruity", "Citrus", "Gourmand", "Spicy", "Oriental", "Leather", "Aquatic"] as const;

export const footerLinks = {
  Shop: [
    { href: "/shop", label: "All fragrances" },
    { href: "/shop?category=silver", label: "Silver collection" },
    { href: "/shop?category=golden", label: "Golden collection" },
  ],
  Help: [
    { href: "/contact", label: "Contact us" },
    { href: "/faq", label: "FAQs" },
    { href: "/shipping-policy", label: "Shipping policy" },
    { href: "/returns-refunds", label: "Returns & refunds" },
    { href: "/account/orders", label: "Track your order" },
  ],
  Company: [
    { href: "/about", label: "Our story" },
    { href: "/terms", label: "Terms of service" },
    { href: "/privacy", label: "Privacy policy" },
  ],
};
