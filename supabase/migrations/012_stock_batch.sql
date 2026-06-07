-- =====================================================================
-- TextilePOS — Migration 012 : entrées de stock groupées (lots)
-- =====================================================================
-- Permet d'enregistrer plusieurs produits en une seule opération (lot),
-- regroupés par batch_id, et de consulter le détail par lot.
-- =====================================================================

-- 1. Colonne batch_id sur stock_movements
alter table public.stock_movements
  add column if not exists batch_id uuid;

create index if not exists idx_movements_batch on public.stock_movements(batch_id);

-- 2. Fonction d'entrée groupée : reçoit un tableau JSON de lignes
--    [{ "product_id": "...", "meters": 50, "price": 220 }, ...]
--    - met à jour le stock de chaque produit
--    - met à jour le prix si fourni (prix modifiable)
--    - enregistre un mouvement par produit, tous liés au même batch_id
create or replace function public.record_stock_batch(
  p_items jsonb,
  p_reason text default 'Réception fournisseur'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_item jsonb;
  v_product_id uuid;
  v_meters numeric(12,2);
  v_price numeric(10,2);
  v_before numeric(12,2);
  v_after numeric(12,2);
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_meters := (v_item->>'meters')::numeric;
    v_price := nullif(v_item->>'price', '')::numeric;

    if v_product_id is null or v_meters is null or v_meters <= 0 then
      continue;
    end if;

    select stock_meters into v_before from public.products where id = v_product_id for update;
    if v_before is null then
      continue;
    end if;

    v_after := v_before + v_meters;

    -- Mise à jour stock + prix (si fourni)
    update public.products
       set stock_meters = v_after,
           price = coalesce(v_price, price),
           default_price_per_meter = coalesce(v_price, default_price_per_meter),
           updated_at = now()
     where id = v_product_id;

    -- Mouvement tracé, lié au lot
    insert into public.stock_movements
      (product_id, type, quantity_change, quantity_before, quantity_after,
       reference_type, reason, movement_label, batch_id, created_by)
    values
      (v_product_id, 'purchase'::stock_movement_type, v_meters, v_before, v_after,
       'batch', p_reason, 'Entrée', v_batch, auth.uid());
  end loop;

  return v_batch;
end;
$$;

grant execute on function public.record_stock_batch(jsonb, text) to authenticated;

-- 3. Vue des lots d'entrée (une ligne par lot, agrégée)
drop view if exists public.v_stock_batches cascade;
create view public.v_stock_batches
with (security_invoker = true)
as
select
  m.batch_id,
  min(m.created_at) as created_at,
  m.reason,
  m.created_by,
  prof.full_name as user_name,
  count(*) as lines_count,
  sum(m.quantity_change) as total_meters
from public.stock_movements m
left join public.profiles prof on prof.id = m.created_by
where m.batch_id is not null
group by m.batch_id, m.reason, m.created_by, prof.full_name
order by min(m.created_at) desc;

grant select on public.v_stock_batches to authenticated;

select 'Migration 012 OK' as status;
