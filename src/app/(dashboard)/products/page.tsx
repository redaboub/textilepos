'use client';

import { useState, useMemo } from 'react';
import { Plus, Edit2, Package, Search, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { useProducts, useCategories } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatMeters, cn } from '@/lib/utils';
import type { Product } from '@/types/database';
import { AddProductDialog } from '@/components/stock/add-product-dialog';
import { AddCategoryDialog } from '@/components/stock/add-category-dialog';
import { useI18n } from '@/lib/i18n/context';

export default function ProductsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data: categories } = useCategories();
  const { data: products, isLoading } = useProducts({ search: search.length >= 1 ? search : undefined });

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (categoryFilter !== 'all') list = list.filter((p) => p.category_id === categoryFilter);
    return list;
  }, [products, categoryFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('products.referentiel')}</p>
          <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('products.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('products.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setAddCategoryOpen(true)}>
            <FolderPlus className="h-4 w-4" /> {t('products.new_category')}
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> {t('products.new_article')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('stock.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="lg:w-64">
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
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.category')}</TableHead>
              <TableHead>{t('common.product')}</TableHead>
              <TableHead className="text-right">{t('common.price')}/m</TableHead>
              <TableHead className="text-right hidden md:table-cell">{t('common.stock')}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />{t('stock.no_article')}
              </TableCell></TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.category?.color ?? '#ccc' }} />
                      {p.category?.name ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(p.price)}</TableCell>
                  <TableCell className="text-right font-mono text-sm hidden md:table-cell">{formatMeters(p.stock_meters)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditing(p)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AddProductDialog open={addOpen} onOpenChange={setAddOpen} />
      <AddCategoryDialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen} />
      <EditProductDialog product={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditProductDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { data: categories } = useCategories();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [threshold, setThreshold] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialiser quand on ouvre
  useMemo(() => {
    if (product) {
      setName(product.name);
      setCategoryId(product.category_id ?? '');
      setPrice(String(product.price));
      setThreshold(String(product.low_stock_threshold));
    }
  }, [product]);

  const handleSave = async () => {
    if (!product) return;
    const p = parseFloat(price);
    const t = parseFloat(threshold);
    if (isNaN(p) || p < 0) { toast.error('Prix invalide'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('products').update({
        name: name.trim(),
        category_id: categoryId || null,
        price: p,
        default_price_per_meter: p,
        low_stock_threshold: isNaN(t) ? 50 : t,
      }).eq('id', product.id);
      if (error) throw error;
      toast.success('Article mis à jour');
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (e: any) {
      toast.error('Erreur', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{t('products.edit_article')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('common.category')}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('clients.name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('products.price_dh')}</Label>
              <Input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1.5 font-mono" />
            </div>
            <div>
              <Label>{t('products.threshold')}</Label>
              <Input type="text" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="mt-1.5 font-mono" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} loading={loading}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
