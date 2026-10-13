/**
 * Hand-picked reviews from the StarGod Premium Perfumes Google listing, quoted
 * as written (long ones trimmed with "…"). Copied on 13 Oct 2026; update the
 * rating summary when the listing changes.
 */
export const GOOGLE_LISTING_URL = "https://maps.google.com/?cid=11476453252145943347";

export const GOOGLE_RATING = { score: "5.0", count: 50 };

export type GoogleReview = { author: string; text: string };

export const GOOGLE_REVIEWS: GoogleReview[] = [
  {
    author: "Pradip Gole",
    text: "Excellent collection of perfumes at affordable prices. The owner is very knowledgeable, honest, and polite. He helped me find a long-lasting, mild fragrance exactly as per my requirement. I was so impressed with my first purchase that I bought another perfume the very next day.",
  },
  {
    author: "Sanika Bhavake",
    text: "Amazing fragrance with excellent longevity and a premium feel. Fresh, elegant, and perfect for everyday use or special occasions. Great value for money and highly recommended.",
  },
  {
    author: "Tushar Baraskar",
    text: "A Must-Visit for Every Perfume Lover in Pune! … And the performance? Absolutely LOVE it! Long-lasting, impressive, and worth every spray. … Definitely one of the best perfume shops in Pune!",
  },
  {
    author: "Siddhant Kulkarni",
    text: "Excellent fragrances and a huge range of options. Service too is good, everyone is very friendly and knowledgeable. 10/10, would recommend.",
  },
];
