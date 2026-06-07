'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import type { Profile, Product } from '@/types/database';
import { useProducts, useCategories, useRealtimeStock } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatMeters, cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

interface Props {
  profile: Profile;
}

interface BatchLine {
  uid: string;
  categoryId: string;
  productId: string;
  meters: string;
  price: string;
}

const newLine = (): BatchLine => ({
  uid: Math.random().toString(36).slice(2),
  categoryId: '',
  productId: '',
  meters: '',
  price: '',
});

export function StockAddClient({ profile }: Props) {
  useRealtimeStock();
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data: categories } = useCategories();
  const { data: products } = useProducts({});
  const [lines, setLines] = useState<BatchLine[]>([newLine()]);
  const [loading, setLoading] = useState(false);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    (products ?? []).forEach((p) => {
      if (!p.category_id) return;
      const arr = map.get(p.category_id) ?? [];
      arr.push(p);
      map.set(p.category_id, arr);
    });
    return map;
  }, [products]);

  const updateLine = (uid: string, patch: Partial<BatchLine>) => {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  };

  const handleCategoryChange = (uid: string, categoryId: string) => {
    updateLine(uid, { categoryId, productId: '', price: '' });
  };

  const handleProductChange = (uid: string, productId: string) => {
    const product = (products ?? []).find((p) => p.id === productId);
    updateLine(uid, { productId, price: product ? String(product.price) : '' });
  };

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (uid: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.uid !== uid) : prev));

  const totalMeters = lines.reduce((sum, l) => sum + (parseFloat(l.meters) || 0), 0);

  const handleSave = async () => {
    // Ne garder que les lignes où un produit est choisi
    const usedLines = lines.filter((l) => l.productId);
    if (usedLines.length === 0) {
      toast.error(t('movement.no_valid_line'));
      return;
    }

    // Validation : quantité ET prix obligatoires pour chaque ligne utilisée
    for (const l of usedLines) {
      const product = (products ?? []).find((p) => p.id === l.productId);
      const name = product?.name ?? '';
      if (!l.meters || parseFloat(l.meters) <= 0) {
        toast.error(t('movement.quantity_required'), { description: name });
        return;
      }
      if (!l.price || parseFloat(l.price) <= 0) {
        toast.error(t('movement.price_required'), { description: name });
        return;
      }
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const items = usedLines.map((l) => ({
        product_id: l.productId,
        meters: parseFloat(l.meters),
        price: parseFloat(l.price),
      }));
      const { error } = await supabase.rpc('record_stock_batch', {
        p_items: items,
        p_reason: t('reason.supplier_reception'),
      });
      if (error) throw error;

      toast.success(t('movement.batch_saved'), {
        description: `${usedLines.length} ${t('common.product')} · ${formatMeters(totalMeters)}`,
      });
      setLines([newLine()]);
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['stock-batches'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (e: any) {
      toast.error(t('common.error'), { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('movement.supply')}</p>
        <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('movement.add_title')}</h1>
        <p className="text-muted-foreground mt-2">{t('movement.batch_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-4 lg:p-6 space-y-4">
          {/* En-têtes */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_140px_140px_44px] gap-3 px-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.category')}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.product')}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.quantity')}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.price')}</div>
            <div />
          </div>

          {/* Lignes */}
          <div className="space-y-2">
            {lines.map((line) => {
              const catProducts = line.categoryId ? (productsByCategory.get(line.categoryId) ?? []) : [];
              return (
                <div key={line.uid} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_140px_140px_44px] gap-2 md:gap-3 md:items-center border md:border-0 border-border/60 rounded-xl md:rounded-none p-3 md:p-0">
                  {/* Catégorie */}
                  <Select value={line.categoryId} onValueChange={(v) => handleCategoryChange(line.uid, v)}>
                    <SelectTrigger><SelectValue placeholder={t('common.category')} /></SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Produit */}
                  <Select value={line.productId} onValueChange={(v) => handleProductChange(line.uid, v)} disabled={!line.categoryId}>
                    <SelectTrigger><SelectValue placeholder={t('common.product')} /></SelectTrigger>
                    <SelectContent>
                      {catProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Quantité */}
                  <Input
                    type="text" inputMode="decimal" value={line.meters}
                    onChange={(e) => updateLine(line.uid, { meters: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    placeholder={t('common.quantity')} className="font-mono text-center"
                  />

                  {/* Prix (modifiable) */}
                  <Input
                    type="text" inputMode="decimal" value={line.price}
                    onChange={(e) => updateLine(line.uid, { price: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    placeholder={t('common.price')} className="font-mono text-center"
                    disabled={!line.productId}
                  />

                  {/* Supprimer ligne */}
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => removeLine(line.uid)}
                    disabled={lines.length === 1}
                    className="text-muted-foreground hover:text-destructive justify-self-end sm:col-span-2 md:col-span-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Bouton ajouter ligne */}
          <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5">
            <Plus className="h-4 w-4" /> {t('movement.add_line')}
          </Button>
        </CardContent>
      </Card>

      {/* Total + enregistrer */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">{t('movement.total_quantity')}</span>
            <span className="font-display text-2xl tabular-nums">{formatMeters(totalMeters)}</span>
          </div>
          <Button size="lg" onClick={handleSave} loading={loading}>
            <PackagePlus className="h-4 w-4" /> {t('movement.save_stock')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
