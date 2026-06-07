'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

/**
 * Historique unifié : lots d'entrée (dépliables) + mouvements individuels
 * (ventes, sorties) dans une seule liste chronologique.
 */
export function MovementHistory() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Tous les mouvements détaillés
  const { data: movements, isLoading } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from('v_stock_movements').select('*').limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  // Construire une liste unifiée :
  // - lot d'entrée (batch_id) = 1 ligne groupée dépliable
  // - vente (reference_type='sale', regroupée par reference_id) = 1 ligne dépliable
  // - le reste = lignes simples
  const rows = useMemo(() => {
    const list = movements ?? [];
    const groups = new Map<string, any>();
    const result: any[] = [];

    for (const m of list) {
      const isSale = m.reference_type === 'sale' && m.reference_id;
      const groupKey = m.batch_id
        ? `batch:${m.batch_id}`
        : isSale
          ? `sale:${m.reference_id}`
          : null;

      if (groupKey) {
        if (!groups.has(groupKey)) {
          const group = {
            kind: m.batch_id ? ('batch' as const) : ('sale' as const),
            id: groupKey,
            created_at: m.created_at,
            reason: m.reason,
            user_name: m.user_name,
            total: 0,
            lines: [] as any[],
          };
          groups.set(groupKey, group);
          result.push(group);
        }
        const g = groups.get(groupKey);
        g.lines.push(m);
        g.total += Number(m.quantity_change ?? 0);
        if (m.created_at < g.created_at) g.created_at = m.created_at;
      } else {
        result.push({ kind: 'single' as const, id: m.id, ...m });
      }
    }

    result.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return result;
  }, [movements]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      if (r.kind === 'batch' || r.kind === 'sale') {
        return (r.reason ?? '').toLowerCase().includes(s) ||
          (r.user_name ?? '').toLowerCase().includes(s) ||
          r.lines.some((l: any) => (l.product_name ?? '').toLowerCase().includes(s));
      }
      return (r.product_name ?? '').toLowerCase().includes(s) ||
        (r.reason ?? '').toLowerCase().includes(s) ||
        (r.user_name ?? '').toLowerCase().includes(s);
    });
  }, [rows, search]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('movement.history_search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rtl:pl-3 rtl:pr-10" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>{t('movement.history_datetime')}</TableHead>
              <TableHead>{t('common.product')}</TableHead>
              <TableHead>{t('movement.history_type')}</TableHead>
              <TableHead className="text-right">{t('common.quantity')}</TableHead>
              <TableHead>{t('movement.reason')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('movement.history_user')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">{t('movement.no_movement')}</TableCell></TableRow>
            ) : (
              filtered.map((r) =>
                r.kind === 'batch' || r.kind === 'sale' ? (
                  <GroupedRows
                    key={r.id}
                    group={r}
                    expanded={expanded === r.id}
                    onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  />
                ) : (
                  <SingleRow key={r.id} m={r} />
                )
              )
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Ligne groupée (lot d'entrée OU vente) + détail dépliable
function GroupedRows({ group, expanded, onToggle }: { group: any; expanded: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const isSale = group.kind === 'sale';
  const sign = group.total >= 0 ? '+' : '';
  const colorClass = isSale ? 'text-destructive' : 'text-success';
  const label = isSale ? t('movement.sale_group') : t('movement.entry_group');

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-accent/50" onClick={onToggle}>
        <TableCell>
          <Button size="icon-sm" variant="ghost">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
          </Button>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(group.created_at)}</TableCell>
        <TableCell className="font-medium text-sm">
          {label} · {group.lines.length} {t('movement.lines_count')}
        </TableCell>
        <TableCell>
          <Badge variant={isSale ? 'destructive' : 'success'} className="text-[10px]">
            {isSale ? t('movement.sale_group') : t('movement.entry')}
          </Badge>
        </TableCell>
        <TableCell className={cn('text-right font-mono font-semibold', colorClass)}>{sign}{group.total} m</TableCell>
        <TableCell className="text-sm">{group.reason ?? '—'}</TableCell>
        <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">{group.user_name ?? '—'}</TableCell>
      </TableRow>
      {expanded && group.lines.map((d: any) => (
        <TableRow key={d.id} className="bg-muted/30">
          <TableCell />
          <TableCell />
          <TableCell className="text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.category_color ?? '#ccc' }} />
              {d.product_name}
              <span className="text-xs text-muted-foreground">{d.category_name}</span>
            </span>
          </TableCell>
          <TableCell>
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
          </TableCell>
          <TableCell className={cn('text-right font-mono text-sm', d.quantity_change >= 0 ? 'text-success' : 'text-destructive')}>
            {d.quantity_change >= 0 ? '+' : ''}{d.quantity_change} m
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">{d.reason ?? '—'}</TableCell>
          <TableCell className="hidden lg:table-cell" />
        </TableRow>
      ))}
    </>
  );
}

// Ligne d'un mouvement individuel (vente, sortie…)
function SingleRow({ m }: { m: any }) {
  const { t } = useI18n();
  const isIn = m.quantity_change >= 0;
  return (
    <TableRow>
      <TableCell />
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(m.created_at)}</TableCell>
      <TableCell className="font-medium text-sm">{m.product_name ?? '—'}</TableCell>
      <TableCell>
        <Badge variant={isIn ? 'success' : 'destructive'} className="text-[10px]">
          {m.movement_label ?? (isIn ? t('movement.entry') : t('movement.exit'))}
        </Badge>
      </TableCell>
      <TableCell className={cn('text-right font-mono font-semibold', isIn ? 'text-success' : 'text-destructive')}>
        {isIn ? '+' : ''}{m.quantity_change} m
      </TableCell>
      <TableCell className="text-sm">{m.reason ?? '—'}</TableCell>
      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">{m.user_name ?? '—'}</TableCell>
    </TableRow>
  );
}
