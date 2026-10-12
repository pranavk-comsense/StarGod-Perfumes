-- =============================================================================
-- Stargod Perfumes: LOCAL DEVELOPMENT SEED
-- Runs on `supabase db reset`. Not applied by `supabase db push`.
-- Creates demo users with known passwords. Never run this against production.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Store settings (all money in paise)
-- -----------------------------------------------------------------------------
insert into public.store_settings (key, value) values
  ('shipping', '{"flat_fee": 7900, "free_above": 99900}'),
  ('cod',      '{"enabled": true, "fee": 4900, "max_order": 500000}'),
  ('checkout', '{"hold_minutes": 30}'),
  ('store',    '{"name": "StarGod Perfumes", "legal_name": "Khushify Fragrances", "gstin": null, "address": "Shop No. 5, Pinnacle Prestige, Tilak Rd, Pantancha Gate, Sadashiv Peth, Pune, Maharashtra 411030", "state": "Maharashtra", "state_code": "27", "support_email": "hello@thestargod.com", "support_phone": "+91 96696 61359"}')
on conflict (key) do update set value = excluded.value;

-- -----------------------------------------------------------------------------
-- Demo users (password for all: Password@123)
--   admin@stargod.test   -> admin
--   staff@stargod.test   -> staff (operations)
--   aarav@stargod.test, diya@stargod.test, kabir@stargod.test -> customers (reviewers)
-- -----------------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@stargod.test', 'Store Admin'),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'staff@stargod.test', 'Ops Staff'),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'aarav@stargod.test', 'Aarav Mehta'),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'diya@stargod.test',  'Diya Sharma'),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'kabir@stargod.test', 'Kabir Rao')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Password@123', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', u.full_name),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now())
    on conflict do nothing;
  end loop;
end $$;

update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set role = 'staff' where id = '00000000-0000-4000-8000-000000000005';
update public.profiles set terms_accepted_at = now();

-- -----------------------------------------------------------------------------
-- Collections
-- -----------------------------------------------------------------------------
insert into public.collections (slug, name, description, sort) values
  ('bestsellers',  'Bestsellers',  'The fragrances our customers keep coming back to.', 1),
  ('new-arrivals', 'New Arrivals', 'Fresh from the atelier.', 2),
  ('gift-sets',    'Gift Sets',    'Beautifully boxed and ready to gift.', 3),
  ('attars',       'Attars',       'Alcohol-free concentrated perfume oils, crafted the traditional way.', 4);

-- -----------------------------------------------------------------------------
-- Notes
-- -----------------------------------------------------------------------------
insert into public.notes (name, family) values
  ('Bergamot', 'Citrus'), ('Lemon', 'Citrus'), ('Grapefruit', 'Citrus'), ('Mandarin', 'Citrus'), ('Neroli', 'Citrus'),
  ('Saffron', 'Spicy'), ('Pink Pepper', 'Spicy'), ('Cardamom', 'Spicy'), ('Cinnamon', 'Spicy'),
  ('Rose', 'Floral'), ('Jasmine', 'Floral'), ('Tuberose', 'Floral'), ('Peony', 'Floral'), ('Orchid', 'Floral'),
  ('Iris', 'Floral'), ('Lavender', 'Aromatic'), ('Basil', 'Aromatic'),
  ('Sea Salt', 'Aquatic'), ('Marine Accord', 'Aquatic'),
  ('Pear', 'Fruity'), ('Lychee', 'Fruity'), ('Blackcurrant', 'Fruity'),
  ('Oud', 'Woody'), ('Sandalwood', 'Woody'), ('Cedarwood', 'Woody'), ('Vetiver', 'Woody'), ('Patchouli', 'Woody'),
  ('Amber', 'Oriental'), ('Benzoin', 'Oriental'), ('Incense', 'Oriental'),
  ('Vanilla', 'Gourmand'), ('Tonka Bean', 'Gourmand'), ('Caramel', 'Gourmand'),
  ('Musk', 'Musky'), ('Leather', 'Leather'), ('Tobacco', 'Leather'),
  ('Wet Earth', 'Earthy'), ('Green Tea', 'Fresh');

-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------
insert into public.products (slug, name, tagline, description, gender, concentration, is_gift_set, is_featured) values
  ('midnight-oud', 'Midnight Oud', 'Smoky oud wrapped in saffron and rose',
   'A nocturnal composition that opens with glowing saffron and bergamot before settling into a heart of Taif-style rose. Rich oud and warm amber linger long after midnight.',
   'men', 'edp', false, true),
  ('azure-tide', 'Azure Tide', 'Sea breeze, citrus and clean musk',
   'Bright lemon and sea salt crash into an aromatic lavender heart, drying down to clean musk and cedarwood. Effortless for hot Indian summers.',
   'men', 'edt', false, true),
  ('leather-monarch', 'Leather Monarch', 'Polished leather, iris and tobacco',
   'Pink pepper sparks over supple leather and powdery iris, resting on a base of cured tobacco and vanilla. Commanding yet refined.',
   'men', 'parfum', false, false),
  ('vetiver-reserve', 'Vetiver Reserve', 'Crisp grapefruit over earthy vetiver',
   'Zesty grapefruit opens onto smoky Haitian vetiver and cedar. A modern, office-friendly signature.',
   'men', 'edp', false, false),
  ('velvet-bloom', 'Velvet Bloom', 'Juicy pear, rose and soft vanilla',
   'Luminous pear and pink pepper lead into a bouquet of rose and jasmine, cushioned by creamy vanilla and musk.',
   'women', 'edp', false, true),
  ('jasmine-noir', 'Jasmine Noir', 'Night-blooming jasmine and sandalwood',
   'Inspired by mogra garlands at dusk: heady jasmine and tuberose over a smooth Mysore-style sandalwood base.',
   'women', 'edp', false, true),
  ('petal-mist', 'Petal Mist', 'Airy lychee, peony and musk',
   'A sheer, playful floral of lychee and peony on a cloud of white musk. Light enough for everyday wear.',
   'women', 'edt', false, false),
  ('sugar-orchid', 'Sugar Orchid', 'Orchid, tonka and caramel',
   'Mandarin sparkles over a lush orchid heart, melting into tonka bean and a whisper of caramel. Sweet, sensual, unforgettable.',
   'women', 'edp', false, false),
  ('santal-sacred', 'Santal Sacred', 'Cardamom-spiced creamy sandalwood',
   'Green cardamom opens onto a meditative sandalwood heart with cedar and musk. Calm, warm and endlessly wearable.',
   'unisex', 'edp', false, true),
  ('citrus-sutra', 'Citrus Sutra', 'Neroli, basil and green tea',
   'A burst of lemon, bergamot and neroli with an herbal basil and green tea heart over vetiver. Pure freshness.',
   'unisex', 'edt', false, false),
  ('amber-raag', 'Amber Raag', 'Resinous amber, incense and benzoin',
   'A slow, golden melody of saffron, incense and amber, deepened by benzoin and patchouli.',
   'unisex', 'parfum', false, false),
  ('royal-kesar-attar', 'Royal Kesar Attar', 'Saffron, rose and sandalwood oil',
   'An alcohol-free attar of precious saffron and rose on a sandalwood base. Apply a drop to the pulse points.',
   'unisex', 'attar', false, true),
  ('mitti-attar', 'Mitti Attar', 'The scent of first rain on earth',
   'Traditional mitti attar capturing petrichor: baked earth and vetiver distilled into sandalwood oil.',
   'unisex', 'attar', false, false),
  ('discovery-set', 'The Discovery Set', 'Five bestsellers, 10 ml each',
   'Find your signature: Midnight Oud, Azure Tide, Velvet Bloom, Jasmine Noir and Santal Sacred in travel-friendly 10 ml sprays.',
   'unisex', 'edp', true, true),
  ('his-and-hers-duo', 'His & Hers Duo', 'Midnight Oud + Velvet Bloom, 50 ml each',
   'A gift for two: our boldest men''s oud paired with our most loved floral, in a keepsake box.',
   'unisex', 'edp', true, false),
  ('attar-trio', 'Attar Trio', 'Three attars in a carved wooden box',
   'Royal Kesar, Mitti and a limited Rose attar, 6 ml each, presented in a hand-carved sheesham box.',
   'unisex', 'attar', true, false);

-- -----------------------------------------------------------------------------
-- Variants (price/mrp in paise)
-- -----------------------------------------------------------------------------
insert into public.product_variants (product_id, sku, size_ml, label, price, mrp, stock, weight_g, sort)
select p.id, v.sku, v.size_ml, v.label, v.price, v.mrp, v.stock, v.weight_g, v.sort
from (values
  ('midnight-oud',     'SG-MO-50',   50, '50 ml',  149900, 179900, 40, 350, 1),
  ('midnight-oud',     'SG-MO-100', 100, '100 ml', 229900, 279900, 25, 550, 2),
  ('azure-tide',       'SG-AT-50',   50, '50 ml',  109900, 139900, 60, 350, 1),
  ('azure-tide',       'SG-AT-100', 100, '100 ml', 169900, 209900, 35, 550, 2),
  ('leather-monarch',  'SG-LM-50',   50, '50 ml',  189900, 229900, 20, 350, 1),
  ('leather-monarch',  'SG-LM-100', 100, '100 ml', 289900, 349900,  0, 550, 2),  -- out of stock
  ('vetiver-reserve',  'SG-VR-50',   50, '50 ml',  119900, 149900, 30, 350, 1),
  ('vetiver-reserve',  'SG-VR-100', 100, '100 ml', 179900, 219900, 18, 550, 2),
  ('velvet-bloom',     'SG-VB-50',   50, '50 ml',  139900, 169900, 45, 350, 1),
  ('velvet-bloom',     'SG-VB-100', 100, '100 ml', 209900, 259900, 22, 550, 2),
  ('jasmine-noir',     'SG-JN-50',   50, '50 ml',  139900, 169900, 38, 350, 1),
  ('jasmine-noir',     'SG-JN-100', 100, '100 ml', 209900, 259900,  2, 550, 2),  -- low stock
  ('petal-mist',       'SG-PM-50',   50, '50 ml',   89900, 119900, 70, 330, 1),
  ('petal-mist',       'SG-PM-100', 100, '100 ml', 139900, 179900, 40, 520, 2),
  ('sugar-orchid',     'SG-SO-50',   50, '50 ml',  129900, 159900, 33, 350, 1),
  ('sugar-orchid',     'SG-SO-100', 100, '100 ml', 199900, 249900, 15, 550, 2),
  ('santal-sacred',    'SG-SS-50',   50, '50 ml',  149900, 179900, 50, 350, 1),
  ('santal-sacred',    'SG-SS-100', 100, '100 ml', 229900, 279900, 28, 550, 2),
  ('citrus-sutra',     'SG-CS-50',   50, '50 ml',   99900, 129900, 55, 350, 1),
  ('citrus-sutra',     'SG-CS-100', 100, '100 ml', 159900, 199900, 30, 550, 2),
  ('amber-raag',       'SG-AR-50',   50, '50 ml',  179900, 219900, 24, 350, 1),
  ('amber-raag',       'SG-AR-100', 100, '100 ml', 269900, 329900, 12, 550, 2),
  ('royal-kesar-attar','SG-RK-6',     6, '6 ml',    79900,  99900, 60, 150, 1),
  ('royal-kesar-attar','SG-RK-12',   12, '12 ml',  139900, 169900, 35, 180, 2),
  ('mitti-attar',      'SG-MA-6',     6, '6 ml',    59900,  79900, 80, 150, 1),
  ('mitti-attar',      'SG-MA-12',   12, '12 ml',   99900, 129900, 40, 180, 2),
  ('discovery-set',    'SG-DS-5X10', 50, '5 × 10 ml', 149900, 199900, 40, 400, 1),
  ('his-and-hers-duo', 'SG-HH-2X50',100, '2 × 50 ml', 269900, 349800, 20, 800, 1),
  ('attar-trio',       'SG-ATR-3X6', 18, '3 × 6 ml',  189900, 249900, 15, 600, 1)
) as v(slug, sku, size_ml, label, price, mrp, stock, weight_g, sort)
join public.products p on p.slug = v.slug;

-- -----------------------------------------------------------------------------
-- Images (root-relative paths are served from /public; uploaded images use
-- storage object paths inside the product-images bucket)
-- -----------------------------------------------------------------------------
insert into public.product_images (product_id, storage_path, alt, sort)
select p.id, '/images/products/' || p.slug || '.svg', p.name || ' bottle', 0
from public.products p;

-- -----------------------------------------------------------------------------
-- Collections membership
-- -----------------------------------------------------------------------------
insert into public.product_collections (product_id, collection_id, sort)
select p.id, c.id, m.sort
from (values
  ('bestsellers', 'midnight-oud', 1), ('bestsellers', 'velvet-bloom', 2), ('bestsellers', 'santal-sacred', 3),
  ('bestsellers', 'azure-tide', 4), ('bestsellers', 'jasmine-noir', 5), ('bestsellers', 'royal-kesar-attar', 6),
  ('new-arrivals', 'amber-raag', 1), ('new-arrivals', 'sugar-orchid', 2), ('new-arrivals', 'citrus-sutra', 3),
  ('new-arrivals', 'mitti-attar', 4),
  ('gift-sets', 'discovery-set', 1), ('gift-sets', 'his-and-hers-duo', 2), ('gift-sets', 'attar-trio', 3),
  ('attars', 'royal-kesar-attar', 1), ('attars', 'mitti-attar', 2), ('attars', 'attar-trio', 3)
) as m(collection, product, sort)
join public.collections c on c.slug = m.collection
join public.products p on p.slug = m.product;

-- -----------------------------------------------------------------------------
-- Fragrance pyramids
-- -----------------------------------------------------------------------------
insert into public.product_notes (product_id, note_id, tier)
select p.id, n.id, x.tier::public.note_tier
from (values
  ('midnight-oud', 'Saffron', 'top'), ('midnight-oud', 'Bergamot', 'top'), ('midnight-oud', 'Rose', 'heart'),
  ('midnight-oud', 'Oud', 'base'), ('midnight-oud', 'Amber', 'base'),
  ('azure-tide', 'Lemon', 'top'), ('azure-tide', 'Sea Salt', 'top'), ('azure-tide', 'Lavender', 'heart'),
  ('azure-tide', 'Marine Accord', 'heart'), ('azure-tide', 'Musk', 'base'), ('azure-tide', 'Cedarwood', 'base'),
  ('leather-monarch', 'Pink Pepper', 'top'), ('leather-monarch', 'Leather', 'heart'), ('leather-monarch', 'Iris', 'heart'),
  ('leather-monarch', 'Tobacco', 'base'), ('leather-monarch', 'Vanilla', 'base'),
  ('vetiver-reserve', 'Grapefruit', 'top'), ('vetiver-reserve', 'Vetiver', 'heart'),
  ('vetiver-reserve', 'Cedarwood', 'base'), ('vetiver-reserve', 'Musk', 'base'),
  ('velvet-bloom', 'Pear', 'top'), ('velvet-bloom', 'Pink Pepper', 'top'), ('velvet-bloom', 'Rose', 'heart'),
  ('velvet-bloom', 'Jasmine', 'heart'), ('velvet-bloom', 'Vanilla', 'base'), ('velvet-bloom', 'Musk', 'base'),
  ('jasmine-noir', 'Bergamot', 'top'), ('jasmine-noir', 'Jasmine', 'heart'), ('jasmine-noir', 'Tuberose', 'heart'),
  ('jasmine-noir', 'Sandalwood', 'base'),
  ('petal-mist', 'Lychee', 'top'), ('petal-mist', 'Peony', 'heart'), ('petal-mist', 'Musk', 'base'),
  ('sugar-orchid', 'Mandarin', 'top'), ('sugar-orchid', 'Orchid', 'heart'), ('sugar-orchid', 'Tonka Bean', 'base'),
  ('sugar-orchid', 'Caramel', 'base'), ('sugar-orchid', 'Vanilla', 'base'),
  ('santal-sacred', 'Cardamom', 'top'), ('santal-sacred', 'Sandalwood', 'heart'),
  ('santal-sacred', 'Cedarwood', 'base'), ('santal-sacred', 'Musk', 'base'),
  ('citrus-sutra', 'Lemon', 'top'), ('citrus-sutra', 'Bergamot', 'top'), ('citrus-sutra', 'Neroli', 'top'),
  ('citrus-sutra', 'Basil', 'heart'), ('citrus-sutra', 'Green Tea', 'heart'), ('citrus-sutra', 'Vetiver', 'base'),
  ('amber-raag', 'Saffron', 'top'), ('amber-raag', 'Incense', 'heart'), ('amber-raag', 'Amber', 'heart'),
  ('amber-raag', 'Benzoin', 'base'), ('amber-raag', 'Patchouli', 'base'),
  ('royal-kesar-attar', 'Saffron', 'top'), ('royal-kesar-attar', 'Rose', 'heart'), ('royal-kesar-attar', 'Sandalwood', 'base'),
  ('mitti-attar', 'Wet Earth', 'top'), ('mitti-attar', 'Vetiver', 'heart'), ('mitti-attar', 'Sandalwood', 'base'),
  ('discovery-set', 'Bergamot', 'top'), ('discovery-set', 'Rose', 'heart'), ('discovery-set', 'Sandalwood', 'base'),
  ('his-and-hers-duo', 'Saffron', 'top'), ('his-and-hers-duo', 'Pear', 'top'), ('his-and-hers-duo', 'Rose', 'heart'),
  ('his-and-hers-duo', 'Oud', 'base'), ('his-and-hers-duo', 'Vanilla', 'base'),
  ('attar-trio', 'Saffron', 'top'), ('attar-trio', 'Rose', 'heart'), ('attar-trio', 'Sandalwood', 'base')
) as x(product, note, tier)
join public.products p on p.slug = x.product
join public.notes n on n.name = x.note;

-- -----------------------------------------------------------------------------
-- Reviews (approved; inserted as postgres so the moderation trigger leaves status alone)
-- -----------------------------------------------------------------------------
insert into public.reviews (product_id, user_id, rating, title, body, status)
select p.id, r.user_id::uuid, r.rating, r.title, r.body, 'approved'
from (values
  ('midnight-oud', '00000000-0000-4000-8000-000000000002', 5, 'Beast mode', 'Lasts 10+ hours on me. Got compliments at a wedding.'),
  ('midnight-oud', '00000000-0000-4000-8000-000000000004', 4, 'Rich and smoky', 'Strong opening, beautiful dry down. A bit heavy for the afternoon.'),
  ('velvet-bloom', '00000000-0000-4000-8000-000000000003', 5, 'My new signature', 'Soft, feminine and not too sweet. The pear note is lovely.'),
  ('azure-tide',   '00000000-0000-4000-8000-000000000002', 4, 'Perfect for summer', 'Fresh and clean. Projection drops after 4 hours.'),
  ('santal-sacred','00000000-0000-4000-8000-000000000003', 5, 'So calming', 'Creamy sandalwood that feels like a warm hug.'),
  ('jasmine-noir', '00000000-0000-4000-8000-000000000003', 5, 'Mogra in a bottle', 'Exactly like fresh jasmine garlands.'),
  ('royal-kesar-attar', '00000000-0000-4000-8000-000000000004', 5, 'Authentic attar', 'One drop lasts all day. Saffron is beautiful.')
) as r(product, user_id, rating, title, body)
join public.products p on p.slug = r.product;

-- -----------------------------------------------------------------------------
-- Demo products are kept only as test fixtures (pgTAP tests activate them inside
-- their own transactions). The real catalog is supabase/catalog/launch_catalog.sql.
-- -----------------------------------------------------------------------------
update public.products set is_active = false;
update public.collections set is_active = false where slug in ('gift-sets', 'attars');

-- -----------------------------------------------------------------------------
-- Coupons
-- -----------------------------------------------------------------------------
insert into public.coupons (code, description, type, value, max_discount, min_order, per_user_limit, first_order_only, usage_limit) values
  ('WELCOME10', '10% off your first order (up to ₹300)', 'percent', 10, 30000, 0,      1, true,  null),
  ('FLAT200',   '₹200 off on orders above ₹1,499',       'flat',    20000, null, 149900, 3, false, 1000),
  ('FREESHIP',  'Free shipping on any order',            'free_shipping', 0, null, 0,  5, false, null);
