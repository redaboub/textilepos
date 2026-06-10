-- =====================================================================
-- TextilePOS — Migration 016 : MODIFIER une vente (atomique, stock ajusté)
-- =====================================================================
-- Permet de corriger une vente déjà enregistrée (articles / quantités /
-- prix / remises / client / paiement) en réajustant AUTOMATIQUEMENT le
-- stock, le tout dans UNE seule transaction (tout réussit ou rien).
--
-- Principe du réajustement : pour chaque produit, on compare le total de
-- mètres AVANT (lignes actuelles) et APRÈS (nouvelles lignes). On applique
-- la différence au stock :
--   - on a vendu plus  -> on retire la différence du stock
--   - on a vendu moins -> on rend la différence au stock
-- Un mouvement de type 'adjustment' trace l'opération.
--
-- Sécurité : caissier limité à son magasin (la fonction est SECURITY
-- DEFINER, on re-vérifie donc le cloisonnement ici).
--
-- ⚠️ Limite assumée : cette fonction ne touche PAS la table `checks`.
-- Si une vente payée par chèque change de montant, ajuste le chèque
-- manuellement dans la page Chèques.
-- =====================================================================

create or replace function public.update_sale(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_sale_id   uuid := nullif(p->>'sale_id', '')::uuid;
  v_store     uuid;
  v_number    text;
  v_pid       uuid;
  v_delta     numeric(12,2);
  v_before    numeric(12,2);
  v_after     numeric(12,2);
  v_item      jsonb;
  v_client_id uuid := nullif(p->>'client_id', '')::uuid;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if v_sale_id is null then raise exception 'Vente introuvable'; end if;

  -- Verrouiller la vente
  select store_id, sale_number into v_store, v_number
  from public.sales where id = v_sale_id for update;
  if v_store is null then raise exception 'Vente introuvable'; end if;

  -- Cloisonnement magasin (la RLS est contournée par SECURITY DEFINER)
  if not public.is_super_admin()
     and v_store is distinct from public.current_user_store() then
    raise exception 'Vente non autorisée';
  end if;

  -- 1) Réajustement du stock par produit (delta = nouveau total - ancien total),
  --    produits traités dans l'ordre du product_id -> pas d'interblocage.
  for v_pid, v_delta in
    select pid, sum(d) as delta
    from (
      -- lignes actuelles : comptent en négatif (ce qui avait été retiré)
      select product_id as pid, -sum(meters_sold) as d
        from public.sale_items
        where sale_id = v_sale_id and product_id is not null
        group by product_id
      union all
      -- nouvelles lignes : comptent en positif
      select (e->>'product_id')::uuid as pid, sum((e->>'meters_sold')::numeric) as d
        from jsonb_array_elements(p->'items') e
        group by (e->>'product_id')::uuid
    ) u
    where pid is not null
    group by pid
    having sum(d) <> 0
    order by pid
  loop
    select stock_meters into v_before from public.products where id = v_pid for update;
    if v_before is null then
      raise exception 'Produit introuvable (%).', v_pid;
    end if;

    v_after := v_before - v_delta;  -- delta>0 : on retire ; delta<0 : on rend
    if v_after < 0 then
      raise exception 'Stock insuffisant pour la modification (produit %). Disponible % m.', v_pid, v_before;
    end if;

    update public.products
       set stock_meters = v_after, updated_at = now()
     where id = v_pid;

    insert into public.stock_movements
      (product_id, type, quantity_change, quantity_before, quantity_after,
       reference_type, reference_id, reason, movement_label, created_by)
    values
      (v_pid, 'adjustment'::stock_movement_type, -v_delta, v_before, v_after,
       'sale_edit', v_sale_id, 'Modification vente ' || v_number, 'Ajustement', v_uid);
  end loop;

  -- 2) Remplacer les lignes de vente
  delete from public.sale_items where sale_id = v_sale_id;

  for v_item in select e from jsonb_array_elements(p->'items') e
  loop
    insert into public.sale_items (
      sale_id, product_id, item_type, meters_sold,
      price_per_meter, discount_percent, line_total, remaining_after_sale
    ) values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      'meter'::sale_item_type,
      (v_item->>'meters_sold')::numeric,
      (v_item->>'price_per_meter')::numeric,
      coalesce((v_item->>'discount_percent')::numeric, 0),
      (v_item->>'line_total')::numeric,
      0
    );
  end loop;

  -- 3) Mettre à jour l'en-tête (totaux recalculés côté app)
  update public.sales set
    client_id       = v_client_id,
    subtotal        = coalesce((p->>'subtotal')::numeric, subtotal),
    discount_amount = coalesce((p->>'discount_amount')::numeric, discount_amount),
    tax_amount      = coalesce((p->>'tax_amount')::numeric, tax_amount),
    total           = coalesce((p->>'total')::numeric, total),
    paid_amount     = coalesce((p->>'paid_amount')::numeric, paid_amount),
    change_amount   = coalesce((p->>'change_amount')::numeric, change_amount),
    credit_amount   = coalesce((p->>'credit_amount')::numeric, credit_amount),
    payment_method  = coalesce((p->>'payment_method')::payment_method, payment_method),
    notes           = nullif(p->>'notes', ''),
    updated_at      = now()
  where id = v_sale_id;

  perform public.flush_low_stock_alerts();
  return v_sale_id;
end;
$$;

grant execute on function public.update_sale(jsonb) to authenticated;

select 'Migration 016 OK — modification de vente atomique' as status;
