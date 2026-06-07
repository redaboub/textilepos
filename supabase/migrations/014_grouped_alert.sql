-- =====================================================================
-- TextilePOS — Migration 014 : alerte stock groupée (un seul WhatsApp par vente)
-- =====================================================================
-- Au lieu d'un message par produit, on accumule les produits qui franchissent
-- le seuil, puis on envoie UN SEUL message groupé en fin de vente.
-- =====================================================================

-- 1. Colonne : produit franchi mais pas encore inclus dans un message envoyé
alter table public.products
  add column if not exists low_stock_pending_notify boolean not null default false;

-- 2. sell_product : ne déclenche plus l'envoi tout de suite.
--    Il marque juste le produit comme "à notifier" lors d'un franchissement.
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
  v_threshold numeric(12,2);
  v_alerted boolean;
begin
  select stock_meters, low_stock_threshold, low_stock_alerted
    into v_before, v_threshold, v_alerted
    from public.products where id = p_product_id for update;

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

  -- FRANCHISSEMENT : marque le produit à notifier (sans envoyer tout de suite)
  if v_before > v_threshold and v_after <= v_threshold and not v_alerted then
    update public.products
      set low_stock_alerted = true,
          low_stock_pending_notify = true
      where id = p_product_id;
  end if;
end;
$$;

grant execute on function public.sell_product(uuid, numeric, uuid, text) to authenticated;

-- 3. flush : envoie UN message groupé pour tous les produits en attente, puis les démarque
create or replace function public.flush_low_stock_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_token text;
  v_items jsonb;
  v_count int;
begin
  select value into v_url from public.app_settings where key = 'alert_function_url';
  select value into v_token from public.app_settings where key = 'alert_function_token';

  -- Récupère les produits en attente de notification
  select jsonb_agg(jsonb_build_object('name', name, 'stock', stock_meters)), count(*)
    into v_items, v_count
    from public.products
    where low_stock_pending_notify = true;

  -- Rien à notifier
  if v_count is null or v_count = 0 then
    return;
  end if;

  -- Démarque tout de suite (évite les doublons)
  update public.products set low_stock_pending_notify = false
    where low_stock_pending_notify = true;

  if v_url is null or v_url = '' then
    return;
  end if;

  -- Un seul appel HTTP avec la liste complète
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_token, '')
    ),
    body := jsonb_build_object('items', v_items)
  );
end;
$$;

grant execute on function public.flush_low_stock_alerts() to authenticated;

-- 4. réarmement à la réception de stock (record_stock_batch) : on réarme aussi le pending
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
  v_threshold numeric(12,2);
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_meters := (v_item->>'meters')::numeric;
    v_price := nullif(v_item->>'price', '')::numeric;

    if v_product_id is null or v_meters is null or v_meters <= 0 then
      continue;
    end if;

    select stock_meters, low_stock_threshold into v_before, v_threshold
      from public.products where id = v_product_id for update;
    if v_before is null then
      continue;
    end if;

    v_after := v_before + v_meters;

    update public.products
       set stock_meters = v_after,
           price = coalesce(v_price, price),
           default_price_per_meter = coalesce(v_price, default_price_per_meter),
           low_stock_alerted = case when v_after > v_threshold then false else low_stock_alerted end,
           low_stock_pending_notify = case when v_after > v_threshold then false else low_stock_pending_notify end,
           updated_at = now()
     where id = v_product_id;

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

select 'Migration 014 OK' as status;
