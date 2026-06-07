-- =====================================================================
-- TextilePOS — Migration 007 : traçabilité des mouvements de stock
-- =====================================================================
-- Enrichit stock_movements et fournit une fonction unique pour
-- enregistrer tout mouvement (entrée / sortie / ajustement) avec motif.
-- =====================================================================

-- 1. Colonnes de traçabilité (motif lisible + libellé type)
alter table public.stock_movements
  add column if not exists reason text,
  add column if not exists movement_label text;

-- 2. Fonction unique de mouvement de stock avec traçabilité complète
create or replace function public.record_stock_movement(
  p_product_id uuid,
  p_quantity numeric,      -- positif = entrée, négatif = sortie
  p_reason text,
  p_label text             -- 'Réception', 'Perte', 'Ajustement', 'Retour'...
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

  v_after := v_before + p_quantity;
  if v_after < 0 then
    raise exception 'Stock insuffisant : stock actuel % m, retrait demandé % m', v_before, abs(p_quantity);
  end if;

  update public.products set stock_meters = v_after, updated_at = now() where id = p_product_id;

  insert into public.stock_movements
    (product_id, type, quantity_change, quantity_before, quantity_after,
     reference_type, reason, movement_label, created_by)
  values
    (p_product_id,
     case when p_quantity >= 0 then 'purchase' else 'adjustment' end,
     p_quantity, v_before, v_after,
     'manual', p_reason, p_label, auth.uid());
end;
$$;

grant execute on function public.record_stock_movement(uuid, numeric, text, text) to authenticated;

-- 3. Vue historique enrichie (avec nom produit + utilisateur)
drop view if exists public.v_stock_movements cascade;
create view public.v_stock_movements
with (security_invoker = true)
as
select
  m.id,
  m.created_at,
  m.product_id,
  p.name as product_name,
  p.product_code,
  c.name as category_name,
  c.color as category_color,
  m.quantity_change,
  m.quantity_before,
  m.quantity_after,
  m.reason,
  m.movement_label,
  m.reference_type,
  m.created_by,
  prof.full_name as user_name
from public.stock_movements m
left join public.products p on p.id = m.product_id
left join public.categories c on c.id = p.category_id
left join public.profiles prof on prof.id = m.created_by
where m.product_id is not null
order by m.created_at desc;

grant select on public.v_stock_movements to authenticated;

-- Vérification
select 'Migration 007 OK' as status,
       (select count(*) from pg_proc where proname = 'record_stock_movement') as fn_exists;
