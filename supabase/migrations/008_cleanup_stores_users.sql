-- =====================================================================
-- TextilePOS — Migration 008 : suppression définitive magasins + users
-- =====================================================================
-- Supprime définitivement les 2 magasins secondaires et nettoie les
-- profils caissiers en trop. Conserve : 1 magasin principal,
-- 1 super admin, 1 caissier (caissier1).
-- =====================================================================

do $$
declare
  v_main_store uuid;
begin
  -- Identifier le magasin principal (le plus ancien / actif)
  select id into v_main_store from public.stores
   where is_active = true order by created_at limit 1;

  -- Rattacher tout ce qui pourrait pointer vers d'autres magasins
  update public.profiles set store_id = v_main_store where store_id is not null;
  update public.sales set store_id = v_main_store where store_id is not null;
  update public.expenses set store_id = v_main_store where store_id is not null;
  update public.checks set store_id = v_main_store where store_id is not null;
  update public.purchases set store_id = v_main_store where store_id is not null;

  -- Supprimer définitivement les autres magasins
  delete from public.stores where id <> v_main_store;
end $$;

-- =====================================================================
-- NETTOYAGE DES PROFILS CAISSIERS EN TROP
-- =====================================================================
-- On garde : le super_admin + UN seul caissier (le plus ancien).
-- Les profils caissiers supplémentaires sont supprimés.
-- ⚠️ Les comptes Auth (email/mot de passe) doivent être supprimés
--    MANUELLEMENT dans Supabase → Authentication → Users (voir doc).
do $$
declare
  v_keep_cashier uuid;
begin
  select id into v_keep_cashier from public.profiles
   where role = 'cashier' order by created_at limit 1;

  if v_keep_cashier is not null then
    delete from public.profiles
     where role = 'cashier' and id <> v_keep_cashier;
  end if;
end $$;

-- Vérification
select
  (select count(*) from public.stores) as magasins,
  (select count(*) from public.profiles where role = 'super_admin') as super_admins,
  (select count(*) from public.profiles where role = 'cashier') as caissiers,
  (select name from public.stores limit 1) as magasin_nom;
