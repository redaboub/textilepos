-- =====================================================================
-- TextilePOS — Row Level Security (RLS) Policies
-- =====================================================================

-- Activer RLS sur toutes les tables sensibles
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.rolls enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.checks enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;

-- Helpers
create or replace function public.current_user_role()
returns user_role language sql stable security definer as $$
    select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_store()
returns uuid language sql stable security definer as $$
    select store_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
    select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- =====================================================================
-- PROFILES
-- =====================================================================
create policy "users can read own profile"
on public.profiles for select using (auth.uid() = id);

create policy "super_admin reads all profiles"
on public.profiles for select using (public.is_super_admin());

create policy "super_admin inserts profiles"
on public.profiles for insert with check (public.is_super_admin());

create policy "super_admin updates profiles"
on public.profiles for update using (public.is_super_admin());

create policy "user updates own profile"
on public.profiles for update using (auth.uid() = id)
with check (auth.uid() = id and role = public.current_user_role());

-- =====================================================================
-- STORES
-- =====================================================================
create policy "authenticated reads stores"
on public.stores for select using (auth.uid() is not null);

create policy "super_admin manages stores"
on public.stores for all using (public.is_super_admin())
with check (public.is_super_admin());

-- =====================================================================
-- DONNÉES PARTAGÉES (categories, clients, suppliers, products, expense_categories)
-- Lecture pour tous les authentifiés, mutations pour super_admin uniquement
-- =====================================================================
create policy "auth reads categories" on public.categories for select using (auth.uid() is not null);
create policy "super_admin manages categories" on public.categories for all
    using (public.is_super_admin()) with check (public.is_super_admin());

create policy "auth reads expense_categories" on public.expense_categories for select using (auth.uid() is not null);
create policy "super_admin manages expense_categories" on public.expense_categories for all
    using (public.is_super_admin()) with check (public.is_super_admin());

create policy "auth reads products" on public.products for select using (auth.uid() is not null);
create policy "super_admin manages products" on public.products for all
    using (public.is_super_admin()) with check (public.is_super_admin());

create policy "auth reads suppliers" on public.suppliers for select using (auth.uid() is not null);
create policy "super_admin manages suppliers" on public.suppliers for all
    using (public.is_super_admin()) with check (public.is_super_admin());

create policy "auth reads clients" on public.clients for select using (auth.uid() is not null);
create policy "auth manages clients" on public.clients for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- =====================================================================
-- ROLLS — caissier ne voit que son magasin
-- =====================================================================
create policy "rolls read scoped"
on public.rolls for select
using (
    public.is_super_admin()
    or store_id = public.current_user_store()
);

create policy "rolls super_admin write"
on public.rolls for all
using (public.is_super_admin())
with check (public.is_super_admin());

-- =====================================================================
-- SALES — caissier crée et lit pour son magasin
-- =====================================================================
create policy "sales read scoped"
on public.sales for select
using (public.is_super_admin() or store_id = public.current_user_store());

create policy "sales insert scoped"
on public.sales for insert
with check (
    public.is_super_admin()
    or (store_id = public.current_user_store() and cashier_id = auth.uid())
);

create policy "sales super_admin update"
on public.sales for update
using (public.is_super_admin())
with check (public.is_super_admin());

-- Items et paiements de vente : suivent l'accès au sale parent
create policy "sale_items scoped"
on public.sale_items for all
using (
    public.is_super_admin()
    or exists (
        select 1 from public.sales s
         where s.id = sale_items.sale_id
           and s.store_id = public.current_user_store()
    )
)
with check (
    public.is_super_admin()
    or exists (
        select 1 from public.sales s
         where s.id = sale_items.sale_id
           and s.store_id = public.current_user_store()
    )
);

create policy "sale_payments scoped"
on public.sale_payments for all
using (
    public.is_super_admin()
    or exists (
        select 1 from public.sales s
         where s.id = sale_payments.sale_id
           and s.store_id = public.current_user_store()
    )
)
with check (
    public.is_super_admin()
    or exists (
        select 1 from public.sales s
         where s.id = sale_payments.sale_id
           and s.store_id = public.current_user_store()
    )
);

-- =====================================================================
-- PURCHASES & PURCHASE_ITEMS — super_admin uniquement (ou par magasin)
-- =====================================================================
create policy "purchases read scoped"
on public.purchases for select
using (public.is_super_admin() or store_id = public.current_user_store());

create policy "purchases super_admin write"
on public.purchases for all
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "purchase_items scoped"
on public.purchase_items for all
using (
    public.is_super_admin()
    or exists (select 1 from public.purchases p where p.id = purchase_items.purchase_id and p.store_id = public.current_user_store())
)
with check (public.is_super_admin());

-- =====================================================================
-- EXPENSES
-- =====================================================================
create policy "expenses read scoped"
on public.expenses for select
using (public.is_super_admin() or store_id = public.current_user_store());

create policy "expenses insert scoped"
on public.expenses for insert
with check (public.is_super_admin() or store_id = public.current_user_store());

create policy "expenses super_admin update"
on public.expenses for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy "expenses super_admin delete"
on public.expenses for delete using (public.is_super_admin());

-- =====================================================================
-- CHECKS
-- =====================================================================
create policy "checks read scoped"
on public.checks for select
using (public.is_super_admin() or store_id = public.current_user_store());

create policy "checks insert scoped"
on public.checks for insert
with check (public.is_super_admin() or store_id = public.current_user_store());

create policy "checks update scoped"
on public.checks for update
using (public.is_super_admin() or store_id = public.current_user_store())
with check (public.is_super_admin() or store_id = public.current_user_store());

create policy "checks super_admin delete"
on public.checks for delete using (public.is_super_admin());

-- =====================================================================
-- TRANSFERTS — super_admin uniquement
-- =====================================================================
create policy "transfers read scoped"
on public.stock_transfers for select
using (
    public.is_super_admin()
    or from_store_id = public.current_user_store()
    or to_store_id = public.current_user_store()
);

create policy "transfers super_admin manage"
on public.stock_transfers for all
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "transfer_items scoped"
on public.stock_transfer_items for all
using (public.is_super_admin())
with check (public.is_super_admin());

-- =====================================================================
-- MOUVEMENTS & LOGS
-- =====================================================================
create policy "movements scoped"
on public.stock_movements for select
using (
    public.is_super_admin()
    or exists (
        select 1 from public.rolls r
         where r.id = stock_movements.roll_id
           and r.store_id = public.current_user_store()
    )
);

create policy "movements system insert"
on public.stock_movements for insert with check (auth.uid() is not null);

create policy "activity own read"
on public.activity_logs for select
using (public.is_super_admin() or user_id = auth.uid());

create policy "activity insert"
on public.activity_logs for insert with check (auth.uid() is not null);

create policy "settings read auth"
on public.settings for select using (auth.uid() is not null);

create policy "settings super_admin write"
on public.settings for all using (public.is_super_admin()) with check (public.is_super_admin());
