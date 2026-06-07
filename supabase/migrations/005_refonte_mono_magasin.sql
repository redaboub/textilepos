-- =====================================================================
-- TextilePOS — Migration 005 : REFONTE mono-magasin + stock par produit
-- =====================================================================
-- ⚠️ Cette migration EFFACE toutes les données de test (produits,
-- rouleaux, ventes, achats) et reconstruit un catalogue simplifié.
-- À exécuter dans Supabase SQL Editor.
-- =====================================================================

-- =====================================================================
-- 1. NETTOYAGE — effacer les données transactionnelles et catalogue
-- =====================================================================
truncate table public.sale_items cascade;
truncate table public.sale_payments cascade;
truncate table public.sales cascade;
truncate table public.purchase_items cascade;
truncate table public.purchases cascade;
truncate table public.stock_movements cascade;
truncate table public.stock_transfer_items cascade;
truncate table public.stock_transfers cascade;
truncate table public.rolls cascade;
truncate table public.products cascade;
truncate table public.categories cascade;

-- =====================================================================
-- 2. STOCK PAR PRODUIT — nouvelles colonnes sur products
-- =====================================================================
alter table public.products
  add column if not exists stock_meters numeric(12,2) not null default 0,
  add column if not exists product_code text,
  add column if not exists price numeric(10,2) not null default 0,
  add column if not exists low_stock_threshold numeric(10,2) not null default 50;

-- product_code unique (KARMA1, PALACE5, etc.)
create unique index if not exists idx_products_code on public.products(product_code)
  where product_code is not null;

-- =====================================================================
-- 3. MAGASIN UNIQUE — garder le premier, rattacher tout le monde
-- =====================================================================
-- On garde le magasin "Magasin Centre" (ou le premier trouvé) comme magasin unique.
do $$
declare
  v_store_id uuid;
begin
  select id into v_store_id from public.stores order by created_at limit 1;

  -- Renommer en magasin unique
  update public.stores set name = 'Magasin Principal' where id = v_store_id;

  -- Rattacher tous les profils à ce magasin
  update public.profiles set store_id = v_store_id;

  -- Désactiver les autres magasins
  update public.stores set is_active = false where id <> v_store_id;
end $$;

-- =====================================================================
-- 4. NOUVELLES CATÉGORIES + 120 PRODUITS
-- =====================================================================
-- Prix aléatoire FIXE par catégorie (modifiable ensuite dans l'app).
do $$
declare
  v_cat record;
  v_cat_id uuid;
  v_price numeric(10,2);
  i int;
  cats text[] := array['KARMA','PALACE','COKITO','COKITA','MALLORCA','BAHAMAS'];
  cat_colors text[] := array['#5645d4','#dd5b00','#2a9d99','#ff64c8','#0075de','#1aae39'];
  c text;
  idx int := 1;
begin
  foreach c in array cats loop
    -- prix aléatoire entre 80 et 250 DH, fixe pour toute la catégorie
    v_price := (floor(random() * 18) * 10 + 80)::numeric(10,2);

    insert into public.categories (name, description, color)
    values (c, 'Catégorie ' || c, cat_colors[idx])
    returning id into v_cat_id;

    for i in 1..20 loop
      insert into public.products
        (name, product_code, sku, category_id, price, default_price_per_meter, stock_meters, low_stock_threshold, is_active)
      values
        (c || i, c || i, c || i, v_cat_id, v_price, v_price, 0, 50, true);
    end loop;

    idx := idx + 1;
  end loop;
end $$;

-- =====================================================================
-- 5. FONCTION DE VENTE — décrémente le stock produit
-- =====================================================================
-- Nouvelle logique : on vend du métrage d'un PRODUIT (plus de rouleau).
create or replace function public.sell_product(
  p_product_id uuid,
  p_meters numeric,
  p_sale_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before numeric(12,2);
  v_after numeric(12,2);
begin
  select stock_meters into v_before from public.products where id = p_product_id for update;
  if v_before is null then
    raise exception 'Produit introuvable';
  end if;
  if v_before < p_meters then
    raise exception 'Stock insuffisant : disponible % m, demandé % m', v_before, p_meters;
  end if;

  v_after := v_before - p_meters;
  update public.products set stock_meters = v_after, updated_at = now() where id = p_product_id;

  insert into public.stock_movements
    (product_id, type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, created_by)
  values
    (p_product_id, 'sale', -p_meters, v_before, v_after, 'sale', p_sale_id, auth.uid());
end;
$$;

grant execute on function public.sell_product(uuid, numeric, uuid) to authenticated;

-- =====================================================================
-- 6. FONCTION D'AJOUT DE STOCK — incrémente le stock produit
-- =====================================================================
create or replace function public.add_product_stock(
  p_product_id uuid,
  p_meters numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before numeric(12,2);
  v_after numeric(12,2);
begin
  select stock_meters into v_before from public.products where id = p_product_id for update;
  if v_before is null then
    raise exception 'Produit introuvable';
  end if;

  v_after := v_before + p_meters;
  update public.products set stock_meters = v_after, updated_at = now() where id = p_product_id;

  insert into public.stock_movements
    (product_id, type, quantity_change, quantity_before, quantity_after, reference_type, created_by)
  values
    (p_product_id, 'purchase', p_meters, v_before, v_after, 'stock_add', auth.uid());
end;
$$;

grant execute on function public.add_product_stock(uuid, numeric) to authenticated;

-- =====================================================================
-- 7. stock_movements — ajouter product_id (au lieu de roll_id)
-- =====================================================================
alter table public.stock_movements
  add column if not exists product_id uuid references public.products(id) on delete set null;
-- roll_id devient optionnel (on ne suit plus les rouleaux)
alter table public.stock_movements alter column roll_id drop not null;

-- =====================================================================
-- 8. sale_items — pointer vers product_id (au lieu de roll_id)
-- =====================================================================
alter table public.sale_items
  add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.sale_items alter column roll_id drop not null;

-- =====================================================================
-- 9. VUE stock faible (seuil 50 m, par produit)
-- =====================================================================
drop view if exists public.v_low_stock cascade;
create view public.v_low_stock
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.product_code,
  p.stock_meters,
  p.low_stock_threshold,
  c.name as category_name,
  c.color as category_color
from public.products p
left join public.categories c on c.id = p.category_id
where p.is_active = true
  and p.stock_meters <= p.low_stock_threshold;

grant select on public.v_low_stock to authenticated;

-- =====================================================================
-- VÉRIFICATION
-- =====================================================================
select
  (select count(*) from public.categories) as categories,
  (select count(*) from public.products) as produits,
  (select count(*) from public.stores where is_active = true) as magasins_actifs,
  (select string_agg(distinct name, ', ') from public.categories) as liste_categories;
