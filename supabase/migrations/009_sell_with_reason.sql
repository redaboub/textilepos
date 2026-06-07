-- =====================================================================
-- TextilePOS — Migration 009 : motif lisible sur les sorties de vente
-- =====================================================================
-- La fonction sell_product enregistre désormais un motif lisible
-- ("Vente client - X") dans l'historique des mouvements de stock.
-- =====================================================================

create or replace function public.sell_product(
  p_product_id uuid,
  p_meters numeric,
  p_sale_id uuid,
  p_reason text default 'Vente'
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
    (product_id, type, quantity_change, quantity_before, quantity_after,
     reference_type, reference_id, reason, movement_label, created_by)
  values
    (p_product_id, 'sale'::stock_movement_type, -p_meters, v_before, v_after,
     'sale', p_sale_id, p_reason, 'Vente', auth.uid());
end;
$$;

grant execute on function public.sell_product(uuid, numeric, uuid, text) to authenticated;

select 'Migration 009 OK' as status;
