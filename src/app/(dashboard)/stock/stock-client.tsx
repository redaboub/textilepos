'use client';

import { useState, useMemo } from 'react';
import { Search, AlertTriangle, Download } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { useProducts, useCategories, useRealtimeStock } from '@/hooks/use-queries';
import { formatCurrency, formatMeters, cn } from '@/lib/utils';
import type { Profile } from '@/types/database';
import { useI18n } from '@/lib/i18n/context';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MovementHistory } from '@/components/stock/movement-history';

interface Props {
  profile: Profile;
}

export function StockClient({ profile }: Props) {
  useRealtimeStock();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low' | 'out'>('all');

  const { data: categories } = useCategories();
  const { data: products, isLoading } = useProducts({ search: search.length >= 1 ? search : undefined });

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (categoryFilter !== 'all') list = list.filter((p) => p.category_id === categoryFilter);
    if (statusFilter === 'in_stock') list = list.filter((p) => p.stock_meters > p.low_stock_threshold);
    if (statusFilter === 'low') list = list.filter((p) => p.stock_meters > 0 && p.stock_meters <= p.low_stock_threshold);
    if (statusFilter === 'out') list = list.filter((p) => p.stock_meters <= 0);
    return list;
  }, [products, categoryFilter, statusFilter]);

  const totalMeters = filtered.reduce((s, p) => s + p.stock_meters, 0);
  const totalValue = filtered.reduce((s, p) => s + p.stock_meters * p.price, 0);
  const lowCount = (products ?? []).filter((p) => p.stock_meters <= p.low_stock_threshold).length;

  const handleExport = async () => {
    if (filtered.length === 0) return;
    try {
      const XLSX = await import('xlsx');
      const rows = filtered.map((p) => ({
        'Catégorie': p.category?.name ?? '',
        'Code': p.product_code ?? '',
        'Produit': p.name,
        'Prix/m': p.price,
        'Stock (m)': p.stock_meters,
        'Valeur stock': p.stock_meters * p.price,
        'État': p.stock_meters <= 0 ? 'Rupture' : (p.stock_meters <= p.low_stock_threshold ? 'Faible' : 'En stock'),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock');
      XLSX.writeFile(wb, `stock_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('stock.inventory')}</p>
          <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('stock.view_title')}</h1>
          <p className="text-muted-foreground mt-2">{t('stock.view_subtitle')}</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> {t('common.export')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('stock.articles_count')}</p>
          <p className="stat-number text-2xl mt-1">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('stock.total_meters')}</p>
          <p className="stat-number text-2xl mt-1">{formatMeters(totalMeters)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('stock.stock_value')}</p>
          <p className="stat-number text-2xl mt-1">{formatCurrency(totalValue, { compact: true })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('stock.low_stock')}</p>
            <p className="stat-number text-2xl">{lowCount}</p>
          </div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">{t('stock.tab_current')}</TabsTrigger>
          <TabsTrigger value="history">{t('stock.tab_history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-6">
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
          <div className="flex gap-2 mt-3">
            {([['all',t('common.all')],['in_stock',t('stock.in_stock')],['low',t('stock.low')],['out',t('stock.out')]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className={cn('px-3 py-1 rounded-md text-xs border', statusFilter === v ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-accent')}>{label}</button>
            ))}
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
              <TableHead className="text-right">{t('common.stock')}</TableHead>
              <TableHead className="text-right hidden md:table-cell">{t('stock.stock_value')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{t('stock.no_article')}</TableCell></TableRow>
            ) : (
              filtered.map((p) => {
                const low = p.stock_meters > 0 && p.stock_meters <= p.low_stock_threshold;
                const out = p.stock_meters <= 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.category?.color ?? '#ccc' }} />
                        {p.category?.name ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(p.price)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatMeters(p.stock_meters)}</TableCell>
                    <TableCell className="text-right font-mono text-sm hidden md:table-cell">{formatCurrency(p.stock_meters * p.price)}</TableCell>
                    <TableCell>
                      {out ? <Badge variant="secondary">{t('stock.out')}</Badge>
                        : low ? <Badge variant="warning">{t('stock.low')}</Badge>
                        : <Badge variant="success">{t('stock.in_stock')}</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
        </TabsContent>

        <TabsContent value="history">
          <MovementHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
