-- =====================================================================
-- TextilePOS — Seed data (données initiales)
-- =====================================================================
-- À exécuter APRÈS avoir créé les utilisateurs dans Supabase Auth
-- Voir README.md pour les étapes de création des comptes.

-- 3 magasins
insert into public.stores (id, name, address, phone, email) values
  ('11111111-1111-1111-1111-111111111111', 'Magasin Centre', 'Avenue Mohamed V, Agadir', '+212 528 12 34 56', 'centre@textilepos.ma'),
  ('22222222-2222-2222-2222-222222222222', 'Magasin Marina', 'Boulevard du 20 Août, Agadir', '+212 528 23 45 67', 'marina@textilepos.ma'),
  ('33333333-3333-3333-3333-333333333333', 'Magasin Founty', 'Quartier Founty, Agadir', '+212 528 34 56 78', 'founty@textilepos.ma')
on conflict (id) do nothing;

-- Catégories de produits
insert into public.categories (name, description, color) values
  ('Coton', 'Tissus en coton', '#3b82f6'),
  ('Soie', 'Tissus en soie', '#a855f7'),
  ('Lin', 'Tissus en lin', '#84cc16'),
  ('Laine', 'Tissus en laine', '#f97316'),
  ('Synthétique', 'Tissus synthétiques', '#06b6d4'),
  ('Velours', 'Velours et veloutés', '#ec4899'),
  ('Brodé', 'Tissus brodés', '#eab308')
on conflict (name) do nothing;

-- Catégories de dépenses
insert into public.expense_categories (name, color) values
  ('Loyer', '#ef4444'),
  ('Électricité', '#f59e0b'),
  ('Eau', '#3b82f6'),
  ('Internet', '#8b5cf6'),
  ('Salaires', '#10b981'),
  ('Transport', '#06b6d4'),
  ('Marketing', '#ec4899'),
  ('Maintenance', '#84cc16'),
  ('Autres', '#6b7280')
on conflict (name) do nothing;

-- Paramètres globaux
insert into public.settings (key, value) values
  ('company_info', '{"name":"TextilePOS","tagline":"Gestion commerciale textile","currency":"MAD","tax_rate":20,"address":"","phone":"","email":""}'),
  ('receipt_settings', '{"width":"80mm","footer_message":"Merci de votre visite !","show_qr":true,"show_logo":false}'),
  ('pos_settings', '{"default_tax_rate":20,"allow_credit":true,"require_client_for_credit":true,"low_stock_threshold":5}')
on conflict (key) do nothing;
