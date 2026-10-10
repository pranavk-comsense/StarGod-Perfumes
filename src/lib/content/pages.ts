import { site } from "@/lib/site";

/**
 * Info & legal pages. DRAFT copy: have it reviewed (and fill in the registered
 * business name, address and GSTIN) before going live. Cashfree reviews these
 * pages during merchant onboarding.
 */
export type InfoPage = { title: string; description: string; updated?: string; sections: { heading?: string; body: string[] }[] };

export const INFO_PAGES: Record<string, InfoPage> = {
  about: {
    title: "Our story",
    description: "StarGod Perfumes blends India's perfumery heritage with modern craft.",
    sections: [
      {
        body: [
          "StarGod Perfumes began with a simple belief: a great fragrance should last all day and shouldn't cost a fortune. We create long-lasting 100 ml eau de parfums inspired by the world's most loved scent profiles, and give each one its own name and story.",
          "Every bottle is blended in small batches and rested before filling, so the notes settle and deepen. We never test on animals.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact us",
    description: "Get help with orders, products and returns.",
    sections: [
      {
        body: [
          `WhatsApp / phone: ${site.supportPhone}`,
          `Email: ${site.supportEmail}`,
          `Instagram: ${site.instagram.handle}`,
          `Visit our store: ${site.store.lines.join(", ")}. ${site.hours}.`,
          "We reply to every message within one working day.",
        ],
      },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    description: "Answers about orders, shipping, payments and our fragrances.",
    sections: [
      { heading: "How long do your perfumes last?", body: ["Our high-concentration eau de parfums are made to last up to 24 hours. Longevity varies with skin type, weather and where you apply: spray on pulse points and clothing for the longest wear."] },
      { heading: "How does Buy 1 Get 1 work?", body: ["Add any two perfumes from the same collection (Silver or Golden) to your bag and the second one is free: the cheaper of each pair is taken off automatically at checkout. Silver and Golden perfumes don't combine with each other."] },
      { heading: "Do you offer Cash on Delivery?", body: ["Yes, on orders up to ₹5,000 across serviceable pincodes. A small COD handling fee applies."] },
      { heading: "How long does delivery take?", body: ["Orders are dispatched within 24–48 hours. Metro cities usually receive them in 2–4 days, other locations in 4–7 days."] },
      { heading: "Can I return a perfume?", body: ["For hygiene reasons, opened fragrances can't be returned. Damaged, leaking or wrong items are replaced free of charge. See our Returns & Refunds policy."] },
    ],
  },
  "shipping-policy": {
    title: "Shipping policy",
    description: "Delivery timelines, charges and coverage.",
    updated: "October 2026",
    sections: [
      { heading: "Coverage", body: ["We ship across India through our courier partners. Enter your pincode on any product page to check delivery availability and estimated time."] },
      { heading: "Charges", body: ["Shipping is free on orders above ₹999. A flat fee of ₹79 applies to smaller orders. A ₹49 handling fee applies to Cash on Delivery orders."] },
      { heading: "Dispatch & delivery", body: ["Orders are dispatched within 24–48 business hours. You'll receive tracking details by email once your order ships, and can follow it from My Orders."] },
    ],
  },
  "returns-refunds": {
    title: "Returns & refunds",
    description: "Our policy on damaged items, cancellations and refunds.",
    updated: "October 2026",
    sections: [
      { heading: "Damaged or incorrect items", body: ["If your order arrives damaged, leaking or incorrect, contact us within 48 hours of delivery with photos or an unboxing video. We'll send a free replacement or issue a full refund."] },
      { heading: "Cancellations", body: ["You can cancel an order from My Orders until it's shipped. Prepaid cancellations are refunded in full to the original payment method."] },
      { heading: "Refund timelines", body: ["Refunds are initiated within 2 business days of approval and usually reach your account in 5–7 business days, depending on your bank."] },
      { heading: "Opened products", body: ["For hygiene reasons, opened or used fragrances cannot be returned unless defective."] },
    ],
  },
  privacy: {
    title: "Privacy policy",
    description: "How we collect, use and protect your personal data.",
    updated: "October 2026",
    sections: [
      { heading: "What we collect", body: ["Name, email, phone number, delivery addresses and order history. Payments are processed by our payment partner; we never see or store your full card or UPI details."] },
      { heading: "How we use it", body: ["To process and deliver orders, provide support, prevent fraud and, only if you opt in, send you offers. You can unsubscribe at any time."] },
      { heading: "Sharing", body: ["We share only what's needed with our payment gateway, courier partners and email provider to fulfil your order. We never sell your data."] },
      { heading: "Your rights", body: ["Under India's Digital Personal Data Protection Act, 2023, you can access, correct or request deletion of your data. Write to " + site.supportEmail + "."] },
      { heading: "Security", body: ["Data is encrypted in transit and at rest, and access is limited to authorised staff."] },
    ],
  },
  terms: {
    title: "Terms of service",
    description: "The terms that apply when you use our website and buy from us.",
    updated: "October 2026",
    sections: [
      { heading: "Orders", body: ["All orders are subject to availability and confirmation. Prices are in Indian Rupees and include GST. We may cancel orders in case of pricing errors or suspected fraud, with a full refund."] },
      { heading: "Accounts", body: ["You're responsible for keeping your password confidential and for activity on your account."] },
      { heading: "Product use", body: ["Fragrances are for external use only. Patch-test before use; discontinue if irritation occurs. Keep away from children and flames."] },
      { heading: "Governing law", body: ["These terms are governed by the laws of India. Courts at Pune, Maharashtra have exclusive jurisdiction."] },
    ],
  },
};
