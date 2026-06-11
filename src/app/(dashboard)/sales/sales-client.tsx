'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Printer, Eye, Pencil, Receipt as ReceiptIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { Receipt } from '@/components/pos/receipt';
import { EditSaleDialog } from './edit-sale-dialog';
import { printReceipt } from '@/lib/print';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils';
import type { Sale, UserRole } from '@/types/database';

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Espèces', check: 'Chèque', transfer: 'Virement', card: 'Espèces', mixed: 'Mixte',
};

export function SalesClient({ role }: { role: UserRole }) {
  const { t } = useI18n();
  const isAdmin = role === 'super_admin';
  const qc = useQueryClient();

  const today = new Date();
  const monthAgo = new Date(); monthAgo.setDate(today.getDate() - 30);
  const [from, setFrom] = useState(monthAgo.toISOString().split('T')[0]);
  const [to, setTo] = useState(today.toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<Sale | null>(null);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [printSale, setPrintSale] = useState<Sale | null>(null);

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales-full', from, to],
    queryFn: async (): Promise<Sale[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('sales')
        .select('*, store:stores(*), cashier:profiles!sales_cashier_id_fkey(id,full_name), client:clients(id,name,phone), items:sale_items(*, product:products(id,name, category:categories(id,name)))')
        .gte('sale_date', new Date(from).toISOString())
        .lte('sale_date', new Date(new Date(to).getTime() + 86400000).toISOString())
        .order('sale_date', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  // Filtre texte côté client (évite toute injection de filtre)
  const term = search.trim().toLowerCase();
  const rows = (sales ?? []).filter((s) =>
    !term ||
    s.sale_number.toLowerCase().includes(term) ||
    (s.client?.name ?? '').toLowerCase().includes(term)
  );

  const totalAmount = rows.reduce((acc, s) => acc + Number(s.total ?? 0), 0);

  const handleReprint = (sale: Sale) => {
    setPrintSale(sale);
    // Laisser React monter le ticket avant de lancer l'impression
    setTimeout(() => printReceipt(), 80);
  };

  // Tant qu'un ticket est prêt à (ré)imprimer, on marque le <body> : SEUL le
  // ticket s'imprime, même si l'impression est lancée par la tablette/navigateur.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (printSale) document.body.classList.add('has-receipt');
    else document.body.classList.remove('has-receipt');
    return () => document.body.classList.remove('has-receipt');
  }, [printSale]);

  // Nettoyer une fois l'impression terminée (ou annulée)
  useEffect(() => {
    const done = () => setPrintSale(null);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('nav.finance')}</p>
        <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('sales.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('sales.page_subtitle')}</p>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="mb-1.5 block text-xs">{t('sales.from')}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">{t('sales.to')}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="mb-1.5 block text-xs">{t('sales.search')}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t('sales.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Synthèse */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('sales.count')}</p>
            <p className="stat-number text-2xl mt-1">{isLoading ? '—' : rows.length}</p>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('sales.total_amount')}</p>
              <p className="stat-number text-2xl mt-1">{isLoading ? '—' : formatCurrency(totalAmount)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tableau */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('reports.sale_number')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead>{t('common.client')}</TableHead>
              {isAdmin && <TableHead>{t('topbar.cashier')}</TableHead>}
              <TableHead className="text-right">{t('common.total')}</TableHead>
              <TableHead className="text-right">{t('sales.articles')}</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={isAdmin ? 7 : 6}><Skeleton className="h-6" /></TableCell></TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-muted-foreground">{t('sales.no_sales')}</TableCell></TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                  <TableCell className="font-mono text-xs">{s.sale_number}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(s.sale_date)}</TableCell>
                  <TableCell className="text-sm">{s.client?.name ?? <span className="text-muted-foreground italic">{t('common.walk_in')}</span>}</TableCell>
                  {isAdmin && <TableCell className="text-xs text-muted-foreground">{s.cashier?.full_name ?? '—'}</TableCell>}
                  <TableCell className="text-right font-mono font-semibold">{formatCurrency(s.total)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{(s.items ?? []).length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(s)} title={t('sales.detail')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleReprint(s)} title={t('sales.reprint')}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)} title={t('sales.edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Détail de la vente */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ReceiptIcon className="h-5 w-5 text-primary" />
                  {selected.sale_number}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label={t('common.date')} value={formatDateTime(selected.sale_date)} />
                  <Info label={t('common.client')} value={selected.client?.name ?? t('common.walk_in')} />
                  <Info label={t('topbar.cashier')} value={selected.cashier?.full_name ?? '—'} />
                  <Info label={t('checkout.payment_method')} value={PAYMENT_LABEL[selected.payment_method] ?? selected.payment_method} />
                </div>

                {/* Articles — liste compacte (évite le débordement d'un tableau en RTL) */}
                <div className="rounded-lg border border-border/60 divide-y divide-border/60">
                  {(selected.items ?? []).map((it, i) => (
                    <div key={it.id || i} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{it.product?.name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {formatNumber(it.meters_sold, 2)} × {formatCurrency(it.price_per_meter)}
                          {it.discount_percent > 0 && <span className="text-warning"> · −{it.discount_percent}%</span>}
                        </div>
                      </div>
                      <div className="font-mono font-semibold text-sm whitespace-nowrap text-foreground">
                        {formatCurrency(it.line_total)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totaux */}
                <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
                  <Row label={t('receipt.subtotal')} value={formatCurrency(selected.subtotal)} />
                  {selected.discount_amount > 0 && <Row label={t('receipt.discount')} value={`−${formatCurrency(selected.discount_amount)}`} />}
                  {selected.tax_amount > 0 && <Row label={t('receipt.tax')} value={formatCurrency(selected.tax_amount)} />}
                  <div className="border-t border-border pt-1.5 mt-1.5">
                    <Row label={<strong>{t('receipt.total')}</strong>} value={<strong>{formatCurrency(selected.total)}</strong>} />
                  </div>
                  {selected.credit_amount > 0 && (
                    <Row label={<span className="text-warning">{t('checkout.credit')}</span>} value={<span className="text-warning">{formatCurrency(selected.credit_amount)}</span>} />
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleReprint(selected)}>
                  <Printer className="h-4 w-4" /> {t('sales.reprint')}
                </Button>
                <Button variant="default" className="w-full sm:w-auto" onClick={() => { setEditing(selected); setSelected(null); }}>
                  <Pencil className="h-4 w-4" /> {t('sales.edit')}
                </Button>
                <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setSelected(null)}>
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket imprimable (portail dans <body>) */}
      {printSale && typeof window !== 'undefined' &&
        createPortal(
          <div className="printable">
            <Receipt sale={printSale} variant="client" />
          </div>,
          document.body,
        )}

      {/* Modifier la vente */}
      <EditSaleDialog
        sale={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['sales-full'] });
          qc.invalidateQueries({ queryKey: ['products'] });
          qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground whitespace-nowrap">{value}</span>
    </div>
  );
}
