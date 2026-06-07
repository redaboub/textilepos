-- =====================================================================
-- TextilePOS — Migration 013 : alerte WhatsApp stock faible (franchissement 50m)
-- =====================================================================
-- Logique B : quand un produit FRANCHIT le seuil (passe de > seuil à <= seuil)
-- suite à une vente, on appelle l'Edge Function qui envoie un WhatsApp via Twilio.
-- Anti-spam : un drapeau low_stock_alerted évite de renvoyer tant que le produit
-- n'a pas été réapprovisionné au-dessus du seuil.
-- =====================================================================

-- 1. Extension pour appels HTTP depuis Postgres (Supabase)
create extension if not exists pg_net with schema extensions;

-- 2. Drapeau anti-spam sur les produits
alter table public.products
  add column if not exists low_stock_alerted boolean not null default false;

-- 3. Réglage : URL de l'Edge Function + clé de service (à définir une fois)
--    On stocke ces réglages dans une petite table de configuration.
create table if not exists public.app_settings (
  key text primary key,
  value text
);

-- Valeurs par défaut (à compléter après déploiement de l'Edge Function) :
insert into public.app_settings (key, value) values
  ('alert_function_url', ''),       -- ex: https://<projet>.supabase.co/functions/v1/send-stock-alert
  ('alert_function_token', '')      -- la clé anon ou service de Supabase
on conflict (key) do nothing;

-- 4. Fonction utilitaire : déclenche l'appel HTTP vers l'Edge Function
create or replace function public.trigger_low_stock_alert(
  p_product_id uuid,
  p_product_name text,
  p_stock numeric
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_token text;
begin
  select value into v_url from public.app_settings where key = 'alert_function_url';
  select value into v_token from public.app_settings where key = 'alert_function_token';

  -- Si non configuré, on ne fait rien (pas d'erreur bloquante pour la vente)
  if v_url is null or v_url = '' then
    return;
  end if;

  perform extensions.net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_token, '')
    ),
    body := jsonb_build_object(
      'product_id', p_product_id,
      'product_name', p_product_name,
      'stock', p_stock
    )
  );
exception when others then
  -- Ne jamais bloquer la vente si l'alerte échoue
  null;
end;
$$;

-- 5. sell_product enrichie : détecte le franchissement et déclenche l'alerte
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
  v_name text;
begin
  select stock_meters, low_stock_threshold, low_stock_alerted, name
    into v_before, v_threshold, v_alerted, v_name
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

  -- FRANCHISSEMENT : passe de > seuil à <= seuil, et pas déjà alerté
  if v_before > v_threshold and v_after <= v_threshold and not v_alerted then
    update public.products set low_stock_alerted = true where id = p_product_id;
    perform public.trigger_low_stock_alert(p_product_id, v_name, v_after);
  end if;
end;
$$;

grant execute on function public.sell_product(uuid, numeric, uuid, text) to authenticated;

-- 6. record_stock_batch : réarme le drapeau quand le stock repasse au-dessus du seuil
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
           -- réarme l'alerte si on repasse au-dessus du seuil
           low_stock_alerted = case when v_after > v_threshold then false else low_stock_alerted end,
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

select 'Migration 013 OK' as status;
