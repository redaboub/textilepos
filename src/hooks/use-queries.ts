'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  Store, Profile, Client, Supplier, Product, Roll, Sale,
  Category, Expense, Check, DashboardStats,
} from '@/types/database';

// Neutralise les caractères qui ont un sens dans les filtres PostgREST
// (`,` sépare des conditions, `()` groupent, `*`/`%` sont des jokers).
// Évite qu'une saisie de recherche puisse altérer ou casser la requête `.or(...)`.
function sanitizeSearch(s: string): string {
  return s.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

// =====================================================================
// PROFILE
// =====================================================================
export function useCurrentProfile() {
  return useQuery({
    queryKey: ['current-profile'],
    queryFn: async (): Promise<Profile | null> => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*, store:stores(*)')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================================================================
// STORES
// =====================================================================
export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async (): Promise<Store[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Store[];
    },
  });
}

// =====================================================================
// CATEGORIES
// =====================================================================
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
  });
}

// =====================================================================
// PRODUCTS
// =====================================================================
export function useProducts(opts: { search?: string; onlyInStock?: boolean } = {}) {
  return useQuery({
    queryKey: ['products', opts],
    queryFn: async (): Promise<Product[]> => {
      const supabase = createClient();
      let q = supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('is_active', true)
        .order('product_code', { ascending: true });

      if (opts.onlyInStock) q = q.gt('stock_meters', 0);

      const search = sanitizeSearch(opts.search ?? '');
      if (search && search.length >= 1) {
        q = q.or(`name.ilike.%${search}%,product_code.ilike.%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      // Tri naturel : KARMA1, KARMA2, ..., KARMA10, KARMA20 (pas 1,10,11,2)
      const sorted = (data as Product[]).sort((a, b) =>
        (a.product_code ?? a.name).localeCompare(b.product_code ?? b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      return sorted;
    },
    staleTime: 5_000,
  });
}

// =====================================================================
// ROLLS — coeur du stock
// =====================================================================
interface RollsFilters {
  storeId?: string | null;
  productId?: string | null;
  search?: string;
  onlyAvailable?: boolean;
}

export function useRolls(filters: RollsFilters = {}) {
  return useQuery({
    queryKey: ['rolls', filters],
    queryFn: async (): Promise<Roll[]> => {
      const supabase = createClient();
      const search = sanitizeSearch(filters.search ?? '');

      // Si on cherche, on doit potentiellement chercher dans le nom du produit aussi.
      // Stratégie : récupérer d'abord les product_ids matchants, puis filtrer.
      let matchingProductIds: string[] = [];
      if (search && search.length >= 2) {
        const { data: prods } = await supabase
          .from('products')
          .select('id')
          .ilike('name', `%${search}%`)
          .limit(50);
        matchingProductIds = (prods ?? []).map((p: any) => p.id);
      }

      let q = supabase
        .from('rolls')
        .select('*, product:products(*, category:categories(*)), store:stores(*), supplier:suppliers(id,name)')
        .order('received_at', { ascending: false });

      if (filters.storeId) q = q.eq('store_id', filters.storeId);
      if (filters.productId) q = q.eq('product_id', filters.productId);
      if (filters.onlyAvailable) q = q.eq('is_sold', false);

      if (search && search.length >= 2) {
        // OR sur serial_number, barcode, et product_id matchant
        const conditions = [
          `serial_number.ilike.%${search}%`,
          `barcode.ilike.%${search}%`,
        ];
        if (matchingProductIds.length > 0) {
          conditions.push(`product_id.in.(${matchingProductIds.join(',')})`);
        }
        q = q.or(conditions.join(','));
      }

      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data as Roll[];
    },
    staleTime: 10_000,
  });
}

export function useRollBySerial(serialOrBarcode: string, storeId?: string | null) {
  return useQuery({
    queryKey: ['roll-search', serialOrBarcode, storeId],
    enabled: serialOrBarcode.length >= 2,
    queryFn: async (): Promise<Roll | null> => {
      const supabase = createClient();
      const term = sanitizeSearch(serialOrBarcode);
      let q = supabase
        .from('rolls')
        .select('*, product:products(*, category:categories(*)), store:stores(*)')
        .or(`serial_number.eq.${term},barcode.eq.${term}`)
        .eq('is_sold', false)
        .limit(1);
      if (storeId) q = q.eq('store_id', storeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data?.[0] as Roll) ?? null;
    },
  });
}

// =====================================================================
// CLIENTS
// =====================================================================
export function useClients(rawSearch?: string) {
  return useQuery({
    queryKey: ['clients', rawSearch],
    queryFn: async (): Promise<Client[]> => {
      const supabase = createClient();
      let q = supabase.from('clients').select('*').eq('is_active', true).order('name');
      const search = sanitizeSearch(rawSearch ?? '');
      if (search && search.length >= 2) {
        q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data as Client[];
    },
  });
}

// =====================================================================
// SUPPLIERS
// =====================================================================
export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async (): Promise<Supplier[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

// =====================================================================
// SALES
// =====================================================================
export function useSales(filters: { storeId?: string | null; limit?: number; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['sales', filters],
    queryFn: async (): Promise<Sale[]> => {
      const supabase = createClient();
      let q = supabase
        .from('sales')
        .select('*, store:stores(id,name), cashier:profiles!sales_cashier_id_fkey(id,full_name), client:clients(id,name,phone), items:sale_items(*, roll:rolls(*, product:products(*)))')
        .order('sale_date', { ascending: false });

      if (filters.storeId) q = q.eq('store_id', filters.storeId);
      if (filters.from) q = q.gte('sale_date', filters.from);
      if (filters.to) q = q.lte('sale_date', filters.to);

      const { data, error } = await q.limit(filters.limit ?? 50);
      if (error) throw error;
      return data as Sale[];
    },
  });
}

// =====================================================================
// DASHBOARD STATS
// =====================================================================
export function useDashboardStats(storeId?: string | null) {
  return useQuery({
    queryKey: ['dashboard-stats', storeId],
    queryFn: async (): Promise<DashboardStats> => {
      const supabase = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Helper : construire une requête sales filtrée
      const salesQuery = (from: Date) => {
        let q = supabase
          .from('sales')
          .select('total', { count: 'exact' })
          .eq('status', 'completed')
          .gte('sale_date', from.toISOString());
        if (storeId) q = q.eq('store_id', storeId);
        return q;
      };

      const lowStockQuery = () =>
        supabase.from('v_low_stock').select('id', { count: 'exact', head: true });

      const activeProductsQuery = () =>
        supabase.from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .gt('stock_meters', 0);

      const [todayRes, monthRes, lowRes, rollsRes, clientsRes, creditRes] = await Promise.all([
        salesQuery(today),
        salesQuery(monthStart),
        lowStockQuery(),
        activeProductsQuery(),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('clients').select('balance'),
      ]);

      const revenueToday = (todayRes.data ?? []).reduce(
        (acc: number, row: any) => acc + Number(row.total ?? 0), 0
      );
      const revenueMonth = (monthRes.data ?? []).reduce(
        (acc: number, row: any) => acc + Number(row.total ?? 0), 0
      );
      const pendingCredit = (creditRes.data ?? []).reduce(
        (acc: number, row: any) => acc + Math.max(0, Number(row.balance ?? 0)), 0
      );

      return {
        revenue_today: revenueToday,
        revenue_month: revenueMonth,
        sales_today: todayRes.count ?? 0,
        sales_month: monthRes.count ?? 0,
        low_stock_count: lowRes.count ?? 0,
        active_rolls: rollsRes.count ?? 0,
        clients_count: clientsRes.count ?? 0,
        pending_credit: pendingCredit,
      };
    },
    refetchInterval: 60_000,
  });
}

// Ventes journalières des 14 derniers jours pour le graphique
export function useDailySalesChart(storeId?: string | null, days = 14) {
  return useQuery({
    queryKey: ['daily-sales-chart', storeId, days],
    queryFn: async () => {
      const supabase = createClient();
      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);

      let q = supabase
        .from('sales')
        .select('sale_date,total,store_id')
        .eq('status', 'completed')
        .gte('sale_date', from.toISOString())
        .order('sale_date');

      if (storeId) q = q.eq('store_id', storeId);

      const { data, error } = await q;
      if (error) throw error;

      // Agréger par jour
      const map = new Map<string, number>();
      for (let i = 0; i <= days; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split('T')[0];
        map.set(key, 0);
      }
      (data ?? []).forEach((r: any) => {
        const key = (r.sale_date as string).split('T')[0];
        map.set(key, (map.get(key) ?? 0) + Number(r.total ?? 0));
      });
      return Array.from(map.entries()).map(([date, revenue]) => ({
        date,
        revenue: Math.round(revenue * 100) / 100,
        label: new Date(date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short' }),
      }));
    },
  });
}

// Top products
export function useTopProducts(storeId?: string | null, limit = 5) {
  return useQuery({
    queryKey: ['top-products', storeId, limit],
    queryFn: async () => {
      const supabase = createClient();
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from('sale_items')
        .select('meters_sold,line_total,product:products(id,name),sale:sales!inner(status,sale_date)')
        .gte('sale.sale_date', since.toISOString())
        .eq('sale.status', 'completed')
        .limit(2000);
      if (error) throw error;

      const map = new Map<string, { name: string; meters: number; revenue: number }>();
      (data ?? []).forEach((r: any) => {
        const product = r.product;
        if (!product) return;
        const cur = map.get(product.id) ?? { name: product.name, meters: 0, revenue: 0 };
        cur.meters += Number(r.meters_sold ?? 0);
        cur.revenue += Number(r.line_total ?? 0);
        map.set(product.id, cur);
      });

      return Array.from(map.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    },
  });
}

// Répartition du CA par catégorie (30 derniers jours)
export function useCategoryRevenue() {
  return useQuery({
    queryKey: ['category-revenue'],
    queryFn: async () => {
      const supabase = createClient();
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from('sale_items')
        .select('line_total,product:products(category:categories(id,name,color)),sale:sales!inner(status,sale_date)')
        .gte('sale.sale_date', since.toISOString())
        .eq('sale.status', 'completed')
        .limit(3000);
      if (error) throw error;

      const map = new Map<string, { name: string; color: string; revenue: number }>();
      (data ?? []).forEach((r: any) => {
        const cat = r.product?.category;
        const key = cat?.id ?? 'none';
        const name = cat?.name ?? 'Sans catégorie';
        const color = cat?.color ?? '#9ca3af';
        const cur = map.get(key) ?? { name, color, revenue: 0 };
        cur.revenue += Number(r.line_total ?? 0);
        map.set(key, cur);
      });

      return Array.from(map.values())
        .filter((c) => c.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue);
    },
  });
}

// Performance par magasin
export function useStorePerformance() {
  return useQuery({
    queryKey: ['store-performance'],
    queryFn: async () => {
      const supabase = createClient();
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from('sales')
        .select('store_id,total,store:stores(name)')
        .eq('status', 'completed')
        .gte('sale_date', since.toISOString());

      if (error) throw error;

      const map = new Map<string, { name: string; revenue: number; count: number }>();
      (data ?? []).forEach((r: any) => {
        const name = r.store?.name ?? '—';
        const cur = map.get(r.store_id) ?? { name, revenue: 0, count: 0 };
        cur.revenue += Number(r.total ?? 0);
        cur.count += 1;
        map.set(r.store_id, cur);
      });

      return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    },
  });
}

// =====================================================================
// EXPENSES
// =====================================================================
export function useExpenses(filters: { storeId?: string | null } = {}) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async (): Promise<Expense[]> => {
      const supabase = createClient();
      let q = supabase
        .from('expenses')
        .select('*, category:expense_categories(id,name,color), store:stores(id,name)')
        .order('expense_date', { ascending: false });
      if (filters.storeId) q = q.eq('store_id', filters.storeId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from('expense_categories').select('*').order('name');
      if (error) throw error;
      return data as { id: string; name: string; color: string }[];
    },
  });
}

// =====================================================================
// CHECKS
// =====================================================================
export function useChecks(filters: { storeId?: string | null } = {}) {
  return useQuery({
    queryKey: ['checks', filters],
    queryFn: async (): Promise<Check[]> => {
      const supabase = createClient();
      let q = supabase
        .from('checks')
        .select('*, store:stores(id,name)')
        .order('due_date', { ascending: true });
      if (filters.storeId) q = q.eq('store_id', filters.storeId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data as Check[];
    },
  });
}

// =====================================================================
// REALTIME — abonnement aux changements
// =====================================================================
export function useRealtimeStock() {
  const qc = useQueryClient();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        qc.invalidateQueries({ queryKey: ['products'] });
        qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, () => {
        qc.invalidateQueries({ queryKey: ['sales'] });
        qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
        qc.invalidateQueries({ queryKey: ['daily-sales-chart'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}
