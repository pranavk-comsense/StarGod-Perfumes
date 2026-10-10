/** Ingredient cut-outs in /public/images/notes, keyed by note slug. */
const NOTE_IMAGES = new Set([
  "amber", "ambergris", "amberwood", "apple", "benzoin", "bergamot", "black-pepper", "blackberry", "cardamom", "cedarwood",
  "cinnamon", "dates", "freesia", "grapefruit", "heliotrope", "incense", "jasmine", "leather", "lemon", "lily", "mandarin",
  "marine-accord", "mimosa", "musk", "myrrh", "neroli", "nutmeg", "oakmoss", "orange-blossom", "orchid", "oud",
  "passion-fruit", "patchouli", "praline", "raspberry", "rose", "saffron", "sandalwood", "sour-cherry", "strawberry",
  "tangerine", "tobacco", "toffee", "tonka-bean", "tropical-fruits", "tuberose", "vanilla", "violet",
]);

export function noteSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function noteImageUrl(name: string): string | null {
  const slug = noteSlug(name);
  return NOTE_IMAGES.has(slug) ? `/images/notes/${slug}.webp` : null;
}
