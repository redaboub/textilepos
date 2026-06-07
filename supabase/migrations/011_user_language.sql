-- =====================================================================
-- TextilePOS — Migration 011 : préférence de langue par utilisateur
-- =====================================================================
alter table public.profiles
  add column if not exists language text not null default 'ar'
  check (language in ('fr', 'ar'));

-- Les utilisateurs existants passent en arabe par défaut (modifiable ensuite)
update public.profiles set language = 'ar' where language is null;

select 'Migration 011 OK' as status,
       (select count(*) from public.profiles) as profils;
