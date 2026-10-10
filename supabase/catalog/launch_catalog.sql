-- =============================================================================
-- StarGod Perfumes: launch catalog (Silver & Golden collections, Buy 1 Get 1).
-- Idempotent: safe to run on local and hosted databases (upserts by slug/sku).
-- Prices in paise. Stock is a starting placeholder; set real counts in
-- Admin → Inventory.
-- =============================================================================

-- Collections ------------------------------------------------------------------
insert into public.collections (slug, name, description, sort, bogo, is_active) values
  ('silver', 'Silver Collection', 'Everyday signatures. Buy 1 Get 1 free on any two Silver fragrances.', 1, true, true),
  ('golden', 'Golden Collection', 'Our richest, longest-lasting blends. Buy 1 Get 1 free on any two Golden fragrances.', 2, true, true),
  ('bestsellers', 'Bestsellers', 'The fragrances our customers keep coming back to.', 3, false, true),
  ('new-arrivals', 'New Arrivals', 'Fresh from the atelier.', 4, false, true)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, sort = excluded.sort, bogo = excluded.bogo, is_active = true;

-- Notes --------------------------------------------------------------------------
insert into public.notes (name, family) values
  ('Strawberry', 'Fruity'), ('Raspberry', 'Fruity'), ('Blackberry', 'Fruity'), ('Sour Cherry', 'Fruity'),
  ('Passion Fruit', 'Fruity'), ('Apple', 'Fruity'), ('Dates', 'Fruity'), ('Tropical Fruits', 'Fruity'),
  ('Tangerine', 'Citrus'), ('Grapefruit', 'Citrus'), ('Bergamot', 'Citrus'), ('Mandarin', 'Citrus'), ('Lemon', 'Citrus'), ('Neroli', 'Citrus'),
  ('Violet', 'Floral'), ('Jasmine', 'Floral'), ('Freesia', 'Floral'), ('Lily', 'Floral'), ('Mimosa', 'Floral'),
  ('Orange Blossom', 'Floral'), ('Heliotrope', 'Floral'), ('Orchid', 'Floral'), ('Rose', 'Floral'), ('Tuberose', 'Floral'),
  ('Cardamom', 'Spicy'), ('Cinnamon', 'Spicy'), ('Nutmeg', 'Spicy'), ('Saffron', 'Spicy'), ('Black Pepper', 'Spicy'),
  ('Toffee', 'Gourmand'), ('Praline', 'Gourmand'), ('Vanilla', 'Gourmand'), ('Tonka Bean', 'Gourmand'),
  ('Amberwood', 'Woody'), ('Sandalwood', 'Woody'), ('Cedarwood', 'Woody'), ('Oud', 'Woody'), ('Patchouli', 'Woody'), ('Oakmoss', 'Woody'),
  ('Amber', 'Oriental'), ('Benzoin', 'Oriental'), ('Myrrh', 'Oriental'), ('Incense', 'Oriental'),
  ('Ambergris', 'Aquatic'), ('Marine Accord', 'Aquatic'),
  ('Musk', 'Musky'), ('Leather', 'Leather'), ('Tobacco', 'Leather')
on conflict (name) do nothing;

-- Products -------------------------------------------------------------------------
insert into public.products (slug, name, tagline, description, gender, concentration, is_gift_set, is_featured, is_active) values
  -- Silver
  ('quick-storm', 'Quick Storm', 'A burst of wild berries over soft violet and musk',
   'Quick Storm opens like a summer downpour on a fruit market: juicy strawberry, raspberry and blackberry with a tart cherry edge. The rush settles into violet and jasmine, then dries down to a creamy veil of vanilla, amber and musk. Playful, youthful and impossible to ignore.',
   'women', 'edp', false, true, true),
  ('honest-liar', 'Honest Liar', 'Spiced cardamom and molten toffee on warm woods',
   'Honest Liar is smooth, confident and a little dangerous. Green cardamom sparks the opening before a rich toffee heart melts into a deep amber-wood base. Warm and addictive, made for evenings and close conversations.',
   'men', 'edp', false, true, true),
  ('potion-trail', 'Potion Trail', 'Luminous neroli and jasmine on an amber-vanilla glow',
   'Potion Trail leaves a soft, glowing trail wherever you go. Bright neroli lifts into a sensual jasmine heart, wrapped in a warm base of amber, vanilla and clean musk. Elegant by day, magnetic by night.',
   'women', 'edp', false, false, true),
  ('immortal-romeo', 'Immortal Romeo', 'Powdery orchid, tropical fruit and creamy vanilla',
   'Immortal Romeo is a soft, sweet embrace. Heliotrope, orchid and tangerine open into a lush heart of tropical fruits and a gourmand accord, settling on vanilla, sandalwood and musk. Cosy, romantic and long-lasting.',
   'women', 'edp', false, false, true),
  ('end-game', 'End Game', 'Sparkling citrus and fresh flowers, pure happiness',
   'End Game is bottled sunshine. Zesty grapefruit, bergamot and mandarin sparkle over a fresh bouquet of freesia and lily, finishing on mimosa and soft musk. Clean, cheerful and perfect for every day.',
   'women', 'edp', false, false, true),
  -- Golden
  ('wise-monk', 'Wise Monk', 'Icy apple and citrus over ambergris and musk',
   'Wise Monk is cool, calm and unforgettable. Crisp apple, lemon and bergamot open with an icy freshness, flowing into orange blossom and a marine breeze, then resting on mineral ambergris and musk. A fresh signature that lasts.',
   'men', 'edp', false, true, true),
  ('rising-shot', 'Rising Shot', 'Passion fruit and saffron on rose, oud and leather',
   'Rising Shot is a bold contrast of bright and dark. Tangy passion fruit, black pepper and saffron burst over a velvety rose heart, before oud, leather and cedarwood take over. Exotic, daring and made to be noticed.',
   'unisex', 'edp', false, false, true),
  ('rogue-alpha', 'Rogue Alpha', 'Cinnamon, saffron and incense over tobacco and vanilla',
   'Rogue Alpha commands the room. Spicy cinnamon, saffron and incense lead into a heart of patchouli and jasmine, deepening into a rich base of tobacco, vanilla, amber and sandalwood. Powerful, warm and long-lasting.',
   'unisex', 'edp', false, true, true),
  ('quick-deception', 'Quick Deception', 'Spiced dates, praline and vanilla, irresistibly sweet',
   'Quick Deception is pure indulgence. Cinnamon and nutmeg warm a bright bergamot opening, leading to sticky dates, praline and tuberose, and finally a cocoon of vanilla, tonka, benzoin and myrrh. Sweet, spicy and seriously compelling.',
   'unisex', 'edp', false, true, true),
  ('iron-will', 'Iron Will', 'Supple leather and cardamom on amber and moss',
   'Iron Will is quiet strength in a bottle. Cardamom opens onto a heart of soft, supple leather and jasmine, grounded by amber, patchouli and a whisper of oakmoss. Refined, rugged and timeless.',
   'unisex', 'edp', false, true, true)
on conflict (slug) do update
  set name = excluded.name, tagline = excluded.tagline, description = excluded.description, gender = excluded.gender,
      concentration = excluded.concentration, is_featured = excluded.is_featured, is_active = true;

-- Variants (100 ml) ----------------------------------------------------------------
insert into public.product_variants (product_id, sku, size_ml, label, price, mrp, stock, weight_g, sort)
select p.id, v.sku, 100, '100 ml', v.price, v.mrp, 25, 450, 1
from (values
  ('quick-storm',     'SG-SV-QST-100', 145500, 333300),
  ('honest-liar',     'SG-SV-HLR-100', 145500, 333300),
  ('potion-trail',    'SG-SV-PTR-100', 145500, 333300),
  ('immortal-romeo',  'SG-SV-IRO-100', 145500, 333300),
  ('end-game',        'SG-SV-EGM-100', 145500, 333300),
  ('wise-monk',       'SG-GD-WMK-100', 185500, 444400),
  ('rising-shot',     'SG-GD-RSH-100', 185500, 444400),
  ('rogue-alpha',     'SG-GD-RAL-100', 185500, 444400),
  ('quick-deception', 'SG-GD-QDC-100', 185500, 444400),
  ('iron-will',       'SG-GD-IRW-100', 185500, 444400)
) as v(slug, sku, price, mrp)
join public.products p on p.slug = v.slug
on conflict (sku) do update set price = excluded.price, mrp = excluded.mrp, label = excluded.label, size_ml = excluded.size_ml;

-- Images: front render (main) + angled render (second, shown on hover), served from /public.
-- Replace with uploaded photos any time via Admin -> Products -> Images.
delete from public.product_images
 where product_id in (select id from public.products where slug in
   ('quick-storm','honest-liar','potion-trail','immortal-romeo','end-game','wise-monk','rising-shot','rogue-alpha','quick-deception','iron-will'))
   and storage_path like '/images/products/%';

insert into public.product_images (product_id, storage_path, alt, sort)
select p.id, '/images/products/' || p.slug || v.suffix, p.name || v.alt, v.sort
from public.products p
cross join (values ('-front.webp', ' eau de parfum 100 ml, front', 0), ('-angle.webp', ' eau de parfum 100 ml, angled', 1)) as v(suffix, alt, sort)
where p.slug in ('quick-storm','honest-liar','potion-trail','immortal-romeo','end-game',
                 'wise-monk','rising-shot','rogue-alpha','quick-deception','iron-will');

-- Collection membership --------------------------------------------------------------
insert into public.product_collections (product_id, collection_id, sort)
select p.id, c.id, m.sort
from (values
  ('silver', 'quick-storm', 1), ('silver', 'honest-liar', 2), ('silver', 'potion-trail', 3),
  ('silver', 'immortal-romeo', 4), ('silver', 'end-game', 5),
  ('golden', 'wise-monk', 1), ('golden', 'rising-shot', 2), ('golden', 'rogue-alpha', 3),
  ('golden', 'quick-deception', 4), ('golden', 'iron-will', 5),
  ('bestsellers', 'quick-deception', 1), ('bestsellers', 'quick-storm', 2), ('bestsellers', 'iron-will', 3), ('bestsellers', 'honest-liar', 4),
  ('new-arrivals', 'wise-monk', 1), ('new-arrivals', 'potion-trail', 2), ('new-arrivals', 'rising-shot', 3), ('new-arrivals', 'immortal-romeo', 4)
) as m(collection, product, sort)
join public.collections c on c.slug = m.collection
join public.products p on p.slug = m.product
on conflict (product_id, collection_id) do update set sort = excluded.sort;

-- Fragrance pyramids --------------------------------------------------------------------
delete from public.product_notes
 where product_id in (select id from public.products where slug in
   ('quick-storm','honest-liar','potion-trail','immortal-romeo','end-game','wise-monk','rising-shot','rogue-alpha','quick-deception','iron-will'));

insert into public.product_notes (product_id, note_id, tier)
select p.id, n.id, x.tier::public.note_tier
from (values
  ('quick-storm', 'Strawberry', 'top'), ('quick-storm', 'Raspberry', 'top'), ('quick-storm', 'Blackberry', 'top'), ('quick-storm', 'Sour Cherry', 'top'),
  ('quick-storm', 'Violet', 'heart'), ('quick-storm', 'Jasmine', 'heart'),
  ('quick-storm', 'Vanilla', 'base'), ('quick-storm', 'Amber', 'base'), ('quick-storm', 'Musk', 'base'),

  ('honest-liar', 'Cardamom', 'top'), ('honest-liar', 'Toffee', 'heart'), ('honest-liar', 'Amberwood', 'base'),

  ('potion-trail', 'Neroli', 'top'), ('potion-trail', 'Jasmine', 'heart'),
  ('potion-trail', 'Amber', 'base'), ('potion-trail', 'Vanilla', 'base'), ('potion-trail', 'Musk', 'base'),

  ('immortal-romeo', 'Heliotrope', 'top'), ('immortal-romeo', 'Orchid', 'top'), ('immortal-romeo', 'Tangerine', 'top'),
  ('immortal-romeo', 'Tropical Fruits', 'heart'),
  ('immortal-romeo', 'Vanilla', 'base'), ('immortal-romeo', 'Sandalwood', 'base'), ('immortal-romeo', 'Musk', 'base'),

  ('end-game', 'Grapefruit', 'top'), ('end-game', 'Bergamot', 'top'), ('end-game', 'Mandarin', 'top'),
  ('end-game', 'Freesia', 'heart'), ('end-game', 'Lily', 'heart'),
  ('end-game', 'Mimosa', 'base'), ('end-game', 'Musk', 'base'),

  ('wise-monk', 'Apple', 'top'), ('wise-monk', 'Lemon', 'top'), ('wise-monk', 'Bergamot', 'top'),
  ('wise-monk', 'Orange Blossom', 'heart'), ('wise-monk', 'Marine Accord', 'heart'),
  ('wise-monk', 'Ambergris', 'base'), ('wise-monk', 'Musk', 'base'),

  ('rising-shot', 'Passion Fruit', 'top'), ('rising-shot', 'Black Pepper', 'top'), ('rising-shot', 'Saffron', 'top'),
  ('rising-shot', 'Rose', 'heart'),
  ('rising-shot', 'Oud', 'base'), ('rising-shot', 'Leather', 'base'), ('rising-shot', 'Cedarwood', 'base'),

  ('rogue-alpha', 'Cinnamon', 'top'), ('rogue-alpha', 'Saffron', 'top'), ('rogue-alpha', 'Incense', 'top'),
  ('rogue-alpha', 'Patchouli', 'heart'), ('rogue-alpha', 'Jasmine', 'heart'),
  ('rogue-alpha', 'Tobacco', 'base'), ('rogue-alpha', 'Vanilla', 'base'), ('rogue-alpha', 'Amber', 'base'), ('rogue-alpha', 'Sandalwood', 'base'),

  ('quick-deception', 'Cinnamon', 'top'), ('quick-deception', 'Nutmeg', 'top'), ('quick-deception', 'Bergamot', 'top'),
  ('quick-deception', 'Dates', 'heart'), ('quick-deception', 'Praline', 'heart'), ('quick-deception', 'Tuberose', 'heart'),
  ('quick-deception', 'Vanilla', 'base'), ('quick-deception', 'Tonka Bean', 'base'), ('quick-deception', 'Benzoin', 'base'), ('quick-deception', 'Myrrh', 'base'),

  ('iron-will', 'Cardamom', 'top'), ('iron-will', 'Leather', 'heart'), ('iron-will', 'Jasmine', 'heart'),
  ('iron-will', 'Amber', 'base'), ('iron-will', 'Patchouli', 'base'), ('iron-will', 'Oakmoss', 'base')
) as x(product, note, tier)
join public.products p on p.slug = x.product
join public.notes n on n.name = x.note;
