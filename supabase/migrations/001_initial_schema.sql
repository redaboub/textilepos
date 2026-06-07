-- =====================================================================
-- TextilePOS — Schéma de base de données complet
-- PostgreSQL 15+ / Supabase
-- =====================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUMS
-- =====================================================================
create type user_role as enum ('super_admin', 'caissier');
create type sale_status as enum ('completed', 'refunded', 'cancelled');
create type sale_item_type as enum ('meter', 'full_roll');
create type payment_method as enum ('cash', 'card', 'check', 'transfer', 'mixed');
create type stock_movement_type as enum ('purchase', 'sale', 'transfer_in', 'transfer_out', 'adjustment', 'return');
create type purchase_status as enum ('pending', 'received', 'cancelled');
create type check_type as enum ('incoming', 'outgoing');
create type check_status as enum ('pending', 'paid', 'rejected', 'cancelled');
create type transfer_status as enum ('pending', 'in_transit', 'received', 'cancelled');

-- =====================================================================
-- TABLES PRINCIPALES
-- =====================================================================

-- Magasins
create table public.stores (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    address text,
    phone text,
    email text,
    tax_id text,
    logo_url text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Profils utilisateurs (lié à auth.users)
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    email text not null unique,
    role user_role not null default 'caissier',
    store_id uuid references public.stores(id) on delete set null,
    phone text,
    avatar_url text,
    is_active boolean not null default true,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_profiles_store on public.profiles(store_id);
create index idx_profiles_role on public.profiles(role);

-- Catégories de produits
create table public.categories (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    description text,
    color text default '#6366f1',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(name)
);

-- Fournisseurs
create table public.suppliers (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    contact_name text,
    phone text,
    email text,
    address text,
    tax_id text,
    notes text,
    total_purchases numeric(14,2) not null default 0,
    balance numeric(14,2) not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_suppliers_name on public.suppliers(name);

-- Clients
create table public.clients (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    phone text,
    email text,
    address text,
    tax_id text,
    notes text,
    total_purchases numeric(14,2) not null default 0,
    balance numeric(14,2) not null default 0, -- dette : positif = client doit
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_clients_name on public.clients(name);
create index idx_clients_phone on public.clients(phone);

-- Produits (modèles de tissus)
create table public.products (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    sku text unique,
    category_id uuid references public.categories(id) on delete set null,
    color text,
    width_cm numeric(6,2),
    default_price_per_meter numeric(10,2) not null default 0,
    description text,
    image_url text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_products_name on public.products(name);
create index idx_products_category on public.products(category_id);
create index idx_products_sku on public.products(sku);

-- Rouleaux (unités de stock uniques)
create table public.rolls (
    id uuid primary key default uuid_generate_v4(),
    serial_number text not null unique,
    barcode text unique,
    product_id uuid not null references public.products(id) on delete restrict,
    store_id uuid not null references public.stores(id) on delete restrict,
    supplier_id uuid references public.suppliers(id) on delete set null,
    initial_length numeric(10,2) not null check (initial_length > 0),
    remaining_length numeric(10,2) not null check (remaining_length >= 0),
    purchase_price_per_meter numeric(10,2) not null default 0,
    selling_price_per_meter numeric(10,2) not null,
    low_stock_threshold numeric(10,2) default 5,
    notes text,
    is_sold boolean not null default false,
    received_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_rolls_serial on public.rolls(serial_number);
create index idx_rolls_barcode on public.rolls(barcode);
create index idx_rolls_product on public.rolls(product_id);
create index idx_rolls_store on public.rolls(store_id);
create index idx_rolls_active on public.rolls(store_id, is_sold) where is_sold = false;

-- Ventes
create table public.sales (
    id uuid primary key default uuid_generate_v4(),
    sale_number text not null unique,
    store_id uuid not null references public.stores(id) on delete restrict,
    cashier_id uuid not null references public.profiles(id) on delete restrict,
    client_id uuid references public.clients(id) on delete set null,
    subtotal numeric(14,2) not null default 0,
    discount_amount numeric(14,2) not null default 0,
    tax_amount numeric(14,2) not null default 0,
    total numeric(14,2) not null default 0,
    paid_amount numeric(14,2) not null default 0,
    change_amount numeric(14,2) not null default 0,
    credit_amount numeric(14,2) not null default 0, -- ce qui reste à payer
    payment_method payment_method not null default 'cash',
    status sale_status not null default 'completed',
    notes text,
    sale_date timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_sales_number on public.sales(sale_number);
create index idx_sales_store on public.sales(store_id);
create index idx_sales_cashier on public.sales(cashier_id);
create index idx_sales_client on public.sales(client_id);
create index idx_sales_date on public.sales(sale_date desc);

-- Lignes de vente
create table public.sale_items (
    id uuid primary key default uuid_generate_v4(),
    sale_id uuid not null references public.sales(id) on delete cascade,
    roll_id uuid not null references public.rolls(id) on delete restrict,
    item_type sale_item_type not null,
    meters_sold numeric(10,2) not null check (meters_sold > 0),
    price_per_meter numeric(10,2) not null,
    discount_percent numeric(5,2) not null default 0,
    line_total numeric(14,2) not null,
    remaining_after_sale numeric(10,2) not null,
    created_at timestamptz not null default now()
);

create index idx_sale_items_sale on public.sale_items(sale_id);
create index idx_sale_items_roll on public.sale_items(roll_id);

-- Paiements multiples (pour paiement mixte)
create table public.sale_payments (
    id uuid primary key default uuid_generate_v4(),
    sale_id uuid not null references public.sales(id) on delete cascade,
    method payment_method not null,
    amount numeric(14,2) not null,
    reference text,
    created_at timestamptz not null default now()
);

create index idx_sale_payments_sale on public.sale_payments(sale_id);

-- Achats fournisseur
create table public.purchases (
    id uuid primary key default uuid_generate_v4(),
    purchase_number text not null unique,
    store_id uuid not null references public.stores(id) on delete restrict,
    supplier_id uuid not null references public.suppliers(id) on delete restrict,
    created_by uuid not null references public.profiles(id) on delete restrict,
    subtotal numeric(14,2) not null default 0,
    tax_amount numeric(14,2) not null default 0,
    total numeric(14,2) not null default 0,
    paid_amount numeric(14,2) not null default 0,
    status purchase_status not null default 'received',
    invoice_number text,
    notes text,
    purchase_date timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_purchases_store on public.purchases(store_id);
create index idx_purchases_supplier on public.purchases(supplier_id);
create index idx_purchases_date on public.purchases(purchase_date desc);

-- Lignes d'achat (les rouleaux reçus)
create table public.purchase_items (
    id uuid primary key default uuid_generate_v4(),
    purchase_id uuid not null references public.purchases(id) on delete cascade,
    roll_id uuid not null references public.rolls(id) on delete restrict,
    length numeric(10,2) not null,
    price_per_meter numeric(10,2) not null,
    line_total numeric(14,2) not null,
    created_at timestamptz not null default now()
);

create index idx_purchase_items_purchase on public.purchase_items(purchase_id);

-- Catégories de dépenses
create table public.expense_categories (
    id uuid primary key default uuid_generate_v4(),
    name text not null unique,
    color text default '#ef4444',
    created_at timestamptz not null default now()
);

-- Dépenses
create table public.expenses (
    id uuid primary key default uuid_generate_v4(),
    store_id uuid not null references public.stores(id) on delete restrict,
    category_id uuid references public.expense_categories(id) on delete set null,
    created_by uuid not null references public.profiles(id) on delete restrict,
    description text not null,
    amount numeric(14,2) not null check (amount > 0),
    payment_method payment_method not null default 'cash',
    expense_date date not null default current_date,
    receipt_url text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_expenses_store on public.expenses(store_id);
create index idx_expenses_date on public.expenses(expense_date desc);

-- Chèques
create table public.checks (
    id uuid primary key default uuid_generate_v4(),
    store_id uuid not null references public.stores(id) on delete restrict,
    type check_type not null,
    check_number text not null,
    bank_name text,
    issuer_name text not null, -- émetteur (client ou fournisseur)
    client_id uuid references public.clients(id) on delete set null,
    supplier_id uuid references public.suppliers(id) on delete set null,
    amount numeric(14,2) not null check (amount > 0),
    issue_date date not null,
    due_date date not null,
    status check_status not null default 'pending',
    notes text,
    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_checks_store on public.checks(store_id);
create index idx_checks_status on public.checks(status);
create index idx_checks_due on public.checks(due_date);

-- Transferts entre magasins
create table public.stock_transfers (
    id uuid primary key default uuid_generate_v4(),
    transfer_number text not null unique,
    from_store_id uuid not null references public.stores(id) on delete restrict,
    to_store_id uuid not null references public.stores(id) on delete restrict,
    created_by uuid not null references public.profiles(id) on delete restrict,
    received_by uuid references public.profiles(id) on delete set null,
    status transfer_status not null default 'pending',
    notes text,
    sent_at timestamptz,
    received_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint different_stores check (from_store_id <> to_store_id)
);

create table public.stock_transfer_items (
    id uuid primary key default uuid_generate_v4(),
    transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
    roll_id uuid not null references public.rolls(id) on delete restrict,
    length_transferred numeric(10,2) not null,
    created_at timestamptz not null default now()
);

-- Mouvements de stock (audit trail)
create table public.stock_movements (
    id uuid primary key default uuid_generate_v4(),
    roll_id uuid not null references public.rolls(id) on delete cascade,
    type stock_movement_type not null,
    quantity_change numeric(10,2) not null, -- négatif pour sortie, positif pour entrée
    quantity_before numeric(10,2) not null,
    quantity_after numeric(10,2) not null,
    reference_type text, -- 'sale', 'purchase', 'transfer', 'adjustment'
    reference_id uuid,
    notes text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create index idx_movements_roll on public.stock_movements(roll_id);
create index idx_movements_type on public.stock_movements(type);
create index idx_movements_date on public.stock_movements(created_at desc);

-- Journal d'activité
create table public.activity_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.profiles(id) on delete set null,
    store_id uuid references public.stores(id) on delete set null,
    action text not null,
    entity_type text,
    entity_id uuid,
    details jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz not null default now()
);

create index idx_activity_user on public.activity_logs(user_id);
create index idx_activity_date on public.activity_logs(created_at desc);

-- Paramètres globaux
create table public.settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
);

-- =====================================================================
-- TRIGGERS — updated_at automatique
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

do $$
declare
    t text;
begin
    for t in
        select unnest(array[
            'stores','profiles','categories','suppliers','clients','products','rolls',
            'sales','purchases','expenses','checks','stock_transfers'
        ])
    loop
        execute format('drop trigger if exists trg_updated_at on public.%I', t);
        execute format('create trigger trg_updated_at before update on public.%I
                        for each row execute function public.set_updated_at()', t);
    end loop;
end$$;

-- =====================================================================
-- FONCTIONS MÉTIER
-- =====================================================================

-- Génération de numéros séquentiels (SALE-2026-000001, etc.)
create or replace function public.generate_document_number(prefix text)
returns text language plpgsql as $$
declare
    seq_name text := lower(prefix) || '_seq';
    next_val bigint;
begin
    execute format('create sequence if not exists %I start 1', seq_name);
    execute format('select nextval(%L)', seq_name) into next_val;
    return prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::text, 6, '0');
end;
$$;

-- Trigger : mise à jour automatique du stock + audit lors d'une vente
create or replace function public.process_sale_item()
returns trigger language plpgsql as $$
declare
    v_before numeric(10,2);
    v_after numeric(10,2);
begin
    select remaining_length into v_before from public.rolls where id = new.roll_id for update;
    if v_before is null then
        raise exception 'Rouleau introuvable';
    end if;
    if v_before < new.meters_sold then
        raise exception 'Stock insuffisant : disponible %, demandé %', v_before, new.meters_sold;
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
         reference_type, reference_id)
    values
        (new.roll_id, 'sale', -new.meters_sold, v_before, v_after,
         'sale', new.sale_id);

    return new;
end;
$$;

drop trigger if exists trg_process_sale_item on public.sale_items;
create trigger trg_process_sale_item
before insert on public.sale_items
for each row execute function public.process_sale_item();

-- Trigger : mise à jour totaux client + activité lors d'une vente
create or replace function public.update_client_totals()
returns trigger language plpgsql as $$
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

-- Trigger : mise à jour totaux fournisseur après achat
create or replace function public.update_supplier_totals()
returns trigger language plpgsql as $$
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
-- VUES UTILITAIRES
-- =====================================================================

create or replace view public.v_low_stock as
select r.id, r.serial_number, r.remaining_length, r.low_stock_threshold,
       p.name as product_name, p.color, s.name as store_name, r.store_id
  from public.rolls r
  join public.products p on p.id = r.product_id
  join public.stores s on s.id = r.store_id
 where r.is_sold = false
   and r.remaining_length <= r.low_stock_threshold;

create or replace view public.v_daily_sales as
select date_trunc('day', sale_date)::date as day,
       store_id,
       count(*) as sales_count,
       sum(total) as revenue,
       sum(discount_amount) as discounts,
       sum(tax_amount) as taxes
  from public.sales
 where status = 'completed'
 group by 1, 2;

create or replace view public.v_product_performance as
select p.id, p.name, p.color,
       count(si.id) as times_sold,
       coalesce(sum(si.meters_sold), 0) as meters_sold,
       coalesce(sum(si.line_total), 0) as revenue
  from public.products p
  left join public.rolls r on r.product_id = p.id
  left join public.sale_items si on si.roll_id = r.id
  left join public.sales s on s.id = si.sale_id and s.status = 'completed'
 group by p.id, p.name, p.color;
