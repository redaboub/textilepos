'use client';

import { useState, useMemo } from 'react';
import { Search, Trash2, ShoppingCart } from 'lucide-react';

import type { Profile, Product } from '@/types/database';
import { useProducts, useCategories, useRealtimeStock } from '@/hooks/use-queries';
import { usePOSStore } from '@/store/pos';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatMeters, cn } from '@/lib/utils';
import { POSCart } from '@/components/pos/cart';
import { CheckoutDialog } from '@/components/pos/checkout-dialog';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';

interface Props {
  profile: Profile;
}

export function POSClient({ profile }: Props) {
  useRealtimeStock();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: categories } = useCategories();
  const { data: products, isLoading } = useProducts({
    search: search.length >= 1 ? search : undefined,
    onlyInStock: true,
  });

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category_id === categoryFilter);
    }
    return list;
  }, [products, categoryFilter]);

  const addItem = usePOSStore((s) => s.addItem);
  const clear = usePOSStore((s) => s.clear);
  const total = usePOSStore((s) => s.total());
  const itemCount = usePOSStore((s) => s.itemCount());

  return (
    <div className="-m-4 xl:-m-8 h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-muted/20">
      {/* Catalogue produits */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 lg:p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-3xl leading-none">{t('pos.title')}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {profile.store?.name ?? 'Magasin'} · {profile.full_name}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('pos.search_product')}
                className="pl-11 rtl:pl-4 rtl:pr-11 h-12 text-base"
              />
            </div>

            {/* Filtre catégorie (menu déroulant) */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-12 sm:w-56 shrink-0">
                <SelectValue placeholder={t('stock.filter_category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('stock.filter_category')}</SelectItem>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 lg:p-6">
            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square skeleton rounded-2xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">{t('pos.no_product')}</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {search
                    ? t('pos.no_product_hint_search')
                    : t('pos.no_product_hint_empty')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                {filtered.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={() => {
                      addItem(product, Math.min(1, product.stock_meters));
                      toast.success(`${product.name} ajouté`, {
                        description: `${formatMeters(product.stock_meters)} ${t('pos.in_stock')}`,
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Panier */}
      <aside className="w-full md:w-[340px] lg:w-[420px] xl:w-[460px] shrink-0 bg-card border-t md:border-t-0 md:border-l border-border flex flex-col max-h-[55vh] md:max-h-none">
        <POSCart profile={profile} />

        <div className="p-4 border-t border-border bg-muted/20 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{t('pos.total_to_pay')}</span>
            <span className="font-display text-3xl tabular-nums">{formatCurrency(total)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => clear()}
              disabled={itemCount === 0}
              className="touch-target"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              className="col-span-2 touch-target"
              disabled={itemCount === 0}
              onClick={() => setCheckoutOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" />
              {t('pos.validate')} ({itemCount})
            </Button>
          </div>
        </div>
      </aside>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        profile={profile}
      />
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const { t } = useI18n();
  const lowStock = product.stock_meters <= product.low_stock_threshold;
  return (
    <button
      onClick={onAdd}
      className={cn(
        'group relative text-start rounded-2xl bg-card border border-border/60 p-3 sm:p-4 transition-all',
        'hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
        'active:scale-[0.98]'
      )}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ backgroundColor: product.category?.color ?? 'hsl(var(--muted))' }}
      />
      <div className="space-y-2.5 min-w-0">
        <div className="min-w-0">
          <h4 className="font-semibold leading-tight text-sm sm:text-base truncate">{product.name}</h4>
          {product.category && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{product.category.name}</p>
          )}
        </div>
        <div className="pt-2 border-t border-border/40 space-y-1">
          {/* Prix en évidence */}
          <div className="font-mono font-bold tabular-nums text-sm sm:text-base leading-none whitespace-nowrap">
            {formatCurrency(product.price)}
            <span className="text-[10px] font-normal text-muted-foreground"> /m</span>
          </div>
          {/* Stock en dessous */}
          <div className={cn('text-[11px] font-medium truncate', lowStock ? 'text-warning' : 'text-muted-foreground')}>
            {lowStock && '⚠ '}
            {formatMeters(product.stock_meters)} · {t('pos.in_stock')}
          </div>
        </div>
      </div>
    </button>
  );
}
