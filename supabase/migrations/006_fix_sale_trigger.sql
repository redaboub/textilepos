-- =====================================================================
-- TextilePOS — Migration 006 : désactiver l'ancien trigger rouleau
-- =====================================================================
-- L'ancien trigger process_sale_item (basé sur roll_id) entre en conflit
-- avec la nouvelle logique de vente par produit (sell_product).
-- On le supprime : la décrémentation du stock se fait désormais
-- via la fonction sell_product() appelée par l'application.
-- =====================================================================

-- Supprimer l'ancien trigger qui décrémentait les rouleaux
drop trigger if exists trg_process_sale_item on public.sale_items;
drop function if exists public.process_sale_item() cascade;

-- Le trigger des totaux client reste utile (il ne touche pas aux rouleaux)
-- On le garde tel quel (déjà en SECURITY DEFINER via migration 004).

-- Vérification : lister les triggers restants sur sale_items
select 'Triggers restants sur sale_items :' as info, tgname as trigger_name
from pg_trigger
where tgrelid = 'public.sale_items'::regclass
  and not tgisinternal;
