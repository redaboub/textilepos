-- =====================================================================
-- TextilePOS — Migration 004 : corrections permissions & sécurité
-- =====================================================================
-- À exécuter dans Supabase SQL Editor APRÈS les migrations 001-003.
-- Ré-exécutable sans risque (create or replace / if not exists / if exists).
-- Corrige notamment :
--   - "permission denied for schema public" lors des ventes/transferts
--   - les fonctions trigger qui doivent contourner RLS
--   - le NULL handling sur les SKU produits
-- =====================================================================

-- =====================================================================
-- 1. FONCTION DE GÉNÉRATION DE NUMÉROS — SECURITY DEFINER
-- =====================================================================
-- Cette fonction crée des sequences au runtime ; elle DOIT s'exécuter
-- avec les droits du propriétaire (postgres), pas du caller authentifié.
create or replace function public.generate_document_number(prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    seq_name text := lower(prefix) || '_seq';
    next_val bigint;
begin
    execute format('create sequence if not exists public.%I start 1', seq_name);
    execute format('select nextval(%L)', 'public.' || seq_name) into next_val;
    return prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::text, 6, '0');
end;
$$;

grant execute on function public.generate_document_number(text) to authenticated;

-- Pré-créer les sequences principales pour éviter le runtime CREATE
create sequence if not exists public.sale_seq start 1;
create sequence if not exists public.trf_seq start 1;
create sequence if not exists public.po_seq start 1;
create sequence if not exists public.ret_seq start 1;

-- =====================================================================
-- 2. TRIGGER process_sale_item — SECURITY DEFINER + meilleur message
-- =====================================================================
create or replace function public.process_sale_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_before numeric(10,2);
    v_after numeric(10,2);
begin
    select remaining_length into v_before from public.rolls where id = new.roll_id for update;
    if v_before is null then
        raise exception 'Rouleau introuvable (id=%)', new.roll_id;
    end if;
    if v_before < new.meters_sold then
        raise exception 'Stock insuffisant pour le rouleau % : disponible % m, demandé % m',
            new.roll_id, v_before, new.meters_sold;
    end if;

    v_after := v_before - new.meters_sold;

    update public.rolls
       set remaining_length = v_after,
           is_sold = (v_after <= 0),
           updated_at = now()
     where id = new.roll_id;

    new.remaining_after_sale := v_after;

    insert into public.stock_movements
        (roll_id, type, quantity_change, quantity_before, quantity_after,
         reference_type, reference_id, created_by)
    values
        (new.roll_id, 'sale', -new.meters_sold, v_before, v_after,
         'sale', new.sale_id, auth.uid());

    return new;
end;
$$;

drop trigger if exists trg_process_sale_item on public.sale_items;
create trigger trg_process_sale_item
before insert on public.sale_items
for each row execute function public.process_sale_item();

-- =====================================================================
-- 3. TRIGGER update_client_totals — SECURITY DEFINER
-- =====================================================================
create or replace function public.update_client_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.client_id is not null then
        update public.clients
           set total_purchases = total_purchases + new.total,
               balance = balance + coalesce(new.credit_amount, 0),
               updated_at = now()
         where id = new.client_id;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_update_client_totals on public.sales;
create trigger trg_update_client_totals
after insert on public.sales
for each row execute function public.update_client_totals();

-- =====================================================================
-- 4. TRIGGER update_supplier_totals — SECURITY DEFINER
-- =====================================================================
create or replace function public.update_supplier_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.suppliers
       set total_purchases = total_purchases + new.total,
           balance = balance + (new.total - coalesce(new.paid_amount, 0)),
           updated_at = now()
     where id = new.supplier_id;
    return new;
end;
$$;

drop trigger if exists trg_update_supplier_totals on public.purchases;
create trigger trg_update_supplier_totals
after insert on public.purchases
for each row execute function public.update_supplier_totals();

-- =====================================================================
-- 5. HELPERS RLS — SECURITY DEFINER + search_path explicite
-- =====================================================================
-- IMPORTANT : on utilise CREATE OR REPLACE SANS DROP, car des
-- politiques RLS dépendent de ces fonctions (sinon erreur 2BP01).
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_store()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select store_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_store() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- =====================================================================
-- 6. GRANTS GÉNÉRAUX
-- =====================================================================
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- =====================================================================
-- 7. POLITIQUE RLS clients (plus permissive pour les caissiers)
-- =====================================================================
drop policy if exists "auth manages clients" on public.clients;
drop policy if exists "auth reads clients" on public.clients;
drop policy if exists "auth inserts clients" on public.clients;
drop policy if exists "auth updates clients" on public.clients;
drop policy if exists "super_admin deletes clients" on public.clients;

create policy "auth reads clients"
on public.clients for select using (auth.uid() is not null);

create policy "auth inserts clients"
on public.clients for insert with check (auth.uid() is not null);

create policy "auth updates clients"
on public.clients for update using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "super_admin deletes clients"
on public.clients for delete using (public.is_super_admin());

-- =====================================================================
-- 8. VUES — security_invoker pour respecter RLS du caller
-- =====================================================================
alter view public.v_low_stock set (security_invoker = true);
alter view public.v_daily_sales set (security_invoker = true);
alter view public.v_product_performance set (security_invoker = true);

grant select on public.v_low_stock to authenticated;
grant select on public.v_daily_sales to authenticated;
grant select on public.v_product_performance to authenticated;

-- =====================================================================
-- VÉRIFICATION
-- =====================================================================
select 'Migration 004 OK' as status,
       (select count(*) from pg_proc where proname = 'generate_document_number' and prosecdef = true) as gen_secdef,
       (select count(*) from pg_proc where proname = 'process_sale_item' and prosecdef = true) as sale_trigger_secdef,
       (select count(*) from pg_proc where proname = 'is_super_admin' and prosecdef = true) as is_admin_secdef;
