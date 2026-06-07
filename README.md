# TextilePOS — Gestion commerciale textile

> Solution SaaS professionnelle de gestion commerciale, caisse et stock pour magasins de tissus et rouleaux textiles.

## ✨ Fonctionnalités

- **Multi-magasins** avec isolation par caissier et vue consolidée Super Admin
- **POS optimisé tactile** avec scan code-barres, vente au mètre et par rouleau complet
- **Gestion fine des rouleaux** — numéro de série unique, suivi métrage en temps réel
- **Multi-paiement** (espèces, carte, chèque, virement) avec gestion du crédit client
- **Impression ticket** thermique 58 mm / 80 mm avec QR code
- **Rapports avancés** avec export PDF et Excel
- **Synchronisation temps réel** via Supabase Realtime
- **PWA installable** sur iOS, Android, Desktop
- **Dark mode / Light mode** automatique

## 🏗 Stack technique

| Couche | Technologies |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, React 19 |
| UI | TailwindCSS, Radix UI primitives, Geist + Instrument Serif |
| State | Zustand, TanStack Query v5 |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Validation | Zod + React Hook Form |
| Charts | Recharts |
| Export | jsPDF, SheetJS |

## 📦 Structure du projet

```
textilepos/
├── public/                    # Assets statiques, manifest PWA, service worker
├── src/
│   ├── app/
│   │   ├── (auth)/            # Pages d'authentification
│   │   │   └── login/
│   │   ├── (dashboard)/       # Application protégée
│   │   │   ├── dashboard/     # Tableau de bord
│   │   │   ├── pos/           # Caisse
│   │   │   ├── stock/         # Rouleaux
│   │   │   ├── products/      # Catalogue produits
│   │   │   ├── clients/       # Clients
│   │   │   ├── suppliers/     # Fournisseurs
│   │   │   ├── purchases/     # Achats
│   │   │   ├── transfers/     # Transferts inter-magasins
│   │   │   ├── expenses/      # Dépenses
│   │   │   ├── checks/        # Chèques
│   │   │   ├── reports/       # Rapports avancés
│   │   │   ├── users/         # Gestion utilisateurs
│   │   │   └── settings/      # Paramètres
│   │   ├── api/               # Routes API
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                # Composants Shadcn-style
│   │   ├── layout/            # Sidebar, Topbar, Sheet
│   │   ├── pos/               # Cart, Checkout, Receipt
│   │   ├── stock/             # Add roll dialog, etc.
│   │   ├── clients/
│   │   ├── dashboard/
│   │   └── providers.tsx
│   ├── hooks/
│   │   └── use-queries.ts     # Tous les hooks React Query
│   ├── lib/
│   │   ├── supabase/          # Clients Supabase (browser, server, middleware)
│   │   ├── auth.ts            # Helpers d'authentification
│   │   ├── utils.ts           # Formatage devises, dates, etc.
│   │   └── validators.ts      # Schémas Zod
│   ├── store/
│   │   ├── pos.ts             # Panier POS (Zustand)
│   │   └── profile.ts
│   ├── types/
│   │   └── database.ts        # Types TypeScript du schéma
│   └── middleware.ts          # Middleware Next.js (auth)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # Schéma complet (16 tables)
│       ├── 002_rls_policies.sql      # Row Level Security
│       └── 003_seed_data.sql         # Données initiales
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.mjs
```

## 🚀 Installation

### 1. Prérequis

- Node.js 20+
- Un projet Supabase ([créer un compte gratuit](https://supabase.com))
- Un éditeur (VS Code recommandé)

### 2. Cloner et installer

```bash
git clone <url-du-repo> textilepos
cd textilepos
npm install
```

### 3. Configurer Supabase

#### 3.1 — Créer le projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → **New Project**
2. Choisir une région proche (ex. `eu-west-3` Paris pour le Maroc)
3. Définir un mot de passe DB fort
4. Attendre ~2 min que le projet soit prêt

#### 3.2 — Exécuter les migrations

Dans le tableau de bord Supabase :

1. **SQL Editor** → **New query**
2. Copier-coller le contenu de `supabase/migrations/001_initial_schema.sql` → **Run**
3. Idem pour `002_rls_policies.sql`
4. Idem pour `003_seed_data.sql`

#### 3.3 — Créer les comptes utilisateurs

Dans Supabase → **Authentication** → **Users** → **Add user** → **Create new user** :

**Compte Super Admin :**
- Email : `admin@textilepos.ma`
- Mot de passe : (choisir)
- Auto Confirm User : ✅

**Comptes Caissier (un par magasin) :**
- `caissier1@textilepos.ma`, `caissier2@textilepos.ma`, `caissier3@textilepos.ma`

Ensuite, pour CHAQUE utilisateur créé, insérer son profil via le SQL Editor :

```sql
-- Récupérer les UUIDs des utilisateurs créés :
select id, email from auth.users;

-- Puis insérer les profils (remplacer les UUIDs) :
insert into public.profiles (id, email, full_name, role, store_id) values
  ('UUID-DU-ADMIN', 'admin@textilepos.ma', 'Super Administrateur', 'super_admin', null),
  ('UUID-CAISSIER-1', 'caissier1@textilepos.ma', 'Caissier Centre', 'caissier', '11111111-1111-1111-1111-111111111111'),
  ('UUID-CAISSIER-2', 'caissier2@textilepos.ma', 'Caissier Marina', 'caissier', '22222222-2222-2222-2222-222222222222'),
  ('UUID-CAISSIER-3', 'caissier3@textilepos.ma', 'Caissier Founty', 'caissier', '33333333-3333-3333-3333-333333333333');
```

#### 3.4 — Récupérer les clés API

Dans Supabase → **Settings** → **API**, copier :
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Configurer l'environnement

```bash
cp .env.example .env.local
```

Éditer `.env.local` avec vos valeurs Supabase.

### 5. Lancer en développement

```bash
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

### 6. Activer le Realtime (optionnel mais recommandé)

Dans Supabase → **Database** → **Replication** → activer le toggle pour les tables `rolls`, `sales`, `sale_items`.

## 🏭 Déploiement en production

### Option A — Vercel (recommandé)

1. Pousser le code sur GitHub
2. Sur [vercel.com](https://vercel.com) → **New Project** → importer le repo
3. Configurer les variables d'environnement (les mêmes que `.env.local`)
4. **Deploy**

L'application sera déployée avec HTTPS automatique, edge functions et CDN global.

### Option B — Docker / Self-hosted

```bash
npm run build
npm run start
```

Servir derrière un reverse proxy (Nginx, Caddy) avec SSL.

## 👥 Comptes par défaut (après seed)

| Rôle | Email | Magasin |
|---|---|---|
| Super Admin | admin@textilepos.ma | Tous |
| Caissier | caissier1@textilepos.ma | Centre |
| Caissier | caissier2@textilepos.ma | Marina |
| Caissier | caissier3@textilepos.ma | Founty |

> ⚠️ **Changer les mots de passe en production.**

## 🖨 Impression ticket

L'application supporte l'impression sur imprimantes thermiques **58 mm** et **80 mm**.

**Configuration tablette Android :**
1. Installer l'app de l'imprimante (RawBT, etc.)
2. Connecter en Bluetooth ou USB
3. Dans Chrome/Edge, l'impression utilisera la fenêtre système

**iPad :**
- Utiliser une imprimante AirPrint compatible

Le ticket est généré via `window.print()` avec des règles CSS `@media print` pour adapter le rendu.

## 🔐 Sécurité

- **Row Level Security (RLS)** activé sur toutes les tables
- Les caissiers ne voient que les données de leur magasin
- Les Super Admins ont une visibilité totale
- Sessions JWT via Supabase Auth, renouvelées automatiquement
- Headers de sécurité configurés dans `next.config.mjs`

## 🧪 Scripts disponibles

```bash
npm run dev          # Développement
npm run build        # Build production
npm run start        # Lancer la version build
npm run lint         # Linter
npm run type-check   # Vérification TypeScript
```

## 📱 PWA — Installer comme application native

L'app est installable sur tous les appareils :
- **Chrome / Edge** : icône d'installation dans la barre d'adresse
- **iOS Safari** : Partager → Ajouter à l'écran d'accueil
- **Android** : bannière automatique ou menu → Installer

Une fois installée, fonctionne en plein écran sans navigateur.

## 🛠 Personnalisation

### Couleurs / thème
Modifier les variables CSS dans `src/app/globals.css` (section `:root` et `.dark`).

### Devise / locale
Variables d'environnement `NEXT_PUBLIC_DEFAULT_CURRENCY` et `NEXT_PUBLIC_DEFAULT_LOCALE`.

### Logo / icônes
Remplacer les fichiers dans `public/icons/`.

## 📄 Licence

Propriétaire. Toute reproduction nécessite une licence commerciale.

---

**TextilePOS** · Conçu pour les professionnels du textile au Maroc et au-delà.
