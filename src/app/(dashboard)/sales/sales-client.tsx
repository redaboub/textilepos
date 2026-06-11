'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Search, Printer, Eye, Pencil, Download, TrendingUp, BarChart3, Package,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';

import { Receipt } from '@/components/pos/receipt';
import { EditSaleDialog } from './edit-sale-dialog';
import { printReceipt } from '@/lib/print';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatMeters } from '@/lib/utils';
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
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const all = sales ?? [];

  // Liste affichée : filtre texte côté client (évite toute injection de filtre)
  const term = search.trim().toLowerCase();
  const rows = all.filter((s) =>
    !term ||
    s.sale_number.toLowerCase().includes(term) ||
    (s.client?.name ?? '').toLowerCase().includes(term)
  );

  // ---- Analyses (admin) : basées sur la période (pas sur la recherche) ----
  const stats = useMemo(() => {
    const revenue = all.reduce((s, x) => s + Number(x.total ?? 0), 0);
    const count = all.length;
    const metersSold = all.reduce((s, x) =>
      s + (x.items ?? []).reduce((m, it) => m + Number(it.meters_sold ?? 0), 0), 0);
    const avgTicket = count > 0 ? revenue / count : 0;
    return { revenue, count, metersSold, avgTicket };
  }, [all]);

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number }>();
    all.forEach((s) => {
      const key = s.sale_date.split('T')[0];
      const cur = map.get(key) ?? { date: key, revenue: 0 };
      cur.revenue += Number(s.total ?? 0);
      map.set(key, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short' }) }));
  }, [all]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; meters: number; revenue: number }>();
    all.forEach((s) => (s.items ?? []).forEach((it) => {
      const p = it.product;
      if (!p) return;
      const cur = map.get(p.id) ?? { name: p.name, meters: 0, revenue: 0 };
      cur.meters += Number(it.meters_sold ?? 0);
      cur.revenue += Number(it.line_total ?? 0);
      map.set(p.id, cur);
    }));
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [all]);

  const handleReprint = (sale: Sale) => {
    setPrintSale(sale);
    // Laisser React rendre le ticket de cette vente avant d'imprimer
    setTimeout(() => printReceipt(), 80);
  };

  // Tant qu'un ticket est sélectionné pour réimpression, on marque <body> :
  // le CSS d'impression n'affiche alors QUE le ticket (voir globals.css).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (printSale) document.body.classList.add('has-receipt');
    else document.body.classList.remove('has-receipt');
    return () => document.body.classList.remove('has-receipt');
  }, [printSale]);

  // Désélectionner le ticket une fois l'impression terminée (ou annulée)
  useEffect(() => {
    const done = () => setPrintSale(null);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  // ---- Exports (admin) ----
  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const data = all.map((s) => ({
        'N° Vente': s.sale_number,
        'Date': formatDate(s.sale_date),
        'Client': s.client?.name ?? t('common.walk_in'),
        'Caissier': s.cashier?.full_name ?? '—',
        'Sous-total': s.subtotal,
        'Remise': s.discount_amount,
        'Total': s.total,
        'Payé': s.paid_amount,
        'Crédit': s.credit_amount,
        'Mode': s.payment_method,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ventes');
      XLSX.writeFile(wb, `ventes_${from}_${to}.xlsx`);
      toast.success('Export Excel généré');
    } catch (e: any) {
      toast.error('Erreur d\'export', { description: e.message });
    }
  };

  const exportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const purple: [number, number, number] = [86, 69, 212];
      const navy: [number, number, number] = [10, 21, 48];
      const slate: [number, number, number] = [93, 91, 84];

      doc.setFillColor(...navy);
      doc.rect(0, 0, pageW, 34, 'F');
      doc.setFillColor(...purple);
      doc.roundedRect(14, 9, 16, 16, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('TX', 22, 19.5, { align: 'center' });
      doc.setFontSize(17);
      doc.text('TextilePOS', 35, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(180, 185, 200);
      doc.text('Rapport de ventes', 35, 23);
      doc.setFontSize(8);
      doc.text(`Généré le ${formatDate(new Date().toISOString())}`, pageW - 14, 14, { align: 'right' });
      doc.text(`Période : ${formatDate(from)} — ${formatDate(to)}`, pageW - 14, 20, { align: 'right' });

      const cardY = 44;
      const cards = [
        { label: 'CHIFFRE D\'AFFAIRES', value: formatCurrency(stats.revenue) },
        { label: 'NOMBRE DE VENTES', value: String(stats.count) },
        { label: 'METRAGE VENDU', value: formatMeters(stats.metersSold) },
        { label: 'PANIER MOYEN', value: formatCurrency(stats.avgTicket) },
      ];
      const cardW = (pageW - 28 - (cards.length - 1) * 4) / cards.length;
      cards.forEach((c, i) => {
        const x = 14 + i * (cardW + 4);
        doc.setFillColor(246, 245, 244);
        doc.roundedRect(x, cardY, cardW, 22, 2, 2, 'F');
        doc.setTextColor(...slate);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(c.label, x + 4, cardY + 7);
        doc.setTextColor(...navy);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(c.value, x + 4, cardY + 16);
      });

      autoTable(doc, {
        startY: cardY + 30,
        head: [['N° Vente', 'Date', 'Client', 'Articles', 'Total']],
        body: all.map((s) => [
          s.sale_number, formatDate(s.sale_date),
          s.client?.name ?? 'Client de passage',
          String((s.items ?? []).length), formatCurrency(s.total),
        ]),
        styles: { fontSize: 8, cellPadding: 3, textColor: [40, 40, 40], lineColor: [229, 227, 223], lineWidth: 0.1 },
        headStyles: { fillColor: purple, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, halign: 'left' },
        alternateRowStyles: { fillColor: [250, 250, 249] },
        columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
        didDrawPage: () => {
          const ph = doc.internal.pageSize.getHeight();
          doc.setFontSize(7);
          doc.setTextColor(...slate);
          doc.setFont('helvetica', 'normal');
          doc.text('TextilePOS — Document généré automatiquement', 14, ph - 8);
          doc.text(`Page ${doc.getNumberOfPages()}`, pageW - 14, ph - 8, { align: 'right' });
        },
      });
      doc.save(`rapport_ventes_${from}_${to}.pdf`);
      toast.success('PDF généré');
    } catch (e: any) {
      toast.error('Erreur d\'export PDF', { description: e.message });
    }
  };

  // ---- Tableau des ventes (réutilisé dans l'onglet Liste et pour le caissier) ----
  const salesTable = (
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
                    <Button size="sm" variant="ghost" onClick={() => setSelected(s)} title={t('sales.detail')}><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleReprint(s)} title={t('sales.reprint')}><Printer className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(s)} title={t('sales.edit')}><Pencil className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('nav.finance')}</p>
        <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('sales.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('sales.page_subtitle')}</p>
      </div>

      {/* Filtres + export */}
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
          <div className={isAdmin ? '' : 'col-span-2'}>
            <Label className="mb-1.5 block text-xs">{t('sales.search')}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder={t('sales.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportPDF} className="flex-1"><Download className="h-4 w-4" /> PDF</Button>
              <Button variant="outline" onClick={exportExcel} className="flex-1"><Download className="h-4 w-4" /> Excel</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Synthèse */}
      <div className={`grid gap-3 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
        {isAdmin && (
          <StatBig label={t('reports.revenue')} value={isLoading ? '—' : formatCurrency(stats.revenue)} icon={TrendingUp} highlight />
        )}
        <StatBig label={t('reports.sales_count')} value={isLoading ? '—' : String(stats.count)} icon={BarChart3} />
        <StatBig label={t('reports.meters_sold')} value={isLoading ? '—' : formatMeters(stats.metersSold)} icon={Package} />
        {isAdmin && (
          <StatBig label={t('reports.avg_ticket')} value={isLoading ? '—' : formatCurrency(stats.avgTicket)} icon={TrendingUp} />
        )}
      </div>

      {/* Admin : onglets (liste / évolution / top produits) — Caissier : liste seule */}
      {isAdmin ? (
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">{t('reports.sales')}</TabsTrigger>
            <TabsTrigger value="evolution">{t('reports.tab_evolution')}</TabsTrigger>
            <TabsTrigger value="products">{t('reports.top_products')}</TabsTrigger>
          </TabsList>

          <TabsContent value="list">{salesTable}</TabsContent>

          <TabsContent value="evolution">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">{t('reports.tab_evolution')}</h3>
                {dailyData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">—</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatCurrency(v)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="revenue" fill="hsl(249 62% 55%)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">{t('reports.top_products')}</h3>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">—</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('common.product')}</TableHead>
                        <TableHead className="text-right">{t('checkout.meters')}</TableHead>
                        <TableHead className="text-right">{t('reports.revenue')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((p, i) => (
                        <TableRow key={p.name + i}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="font-mono text-xs text-muted-foreground w-6">#{i + 1}</div>
                              <div className="w-1 h-8 rounded-full bg-primary/40" />
                              <div className="font-medium">{p.name}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatMeters(p.meters)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        salesTable
      )}

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

      {/* Ticket imprimable — portail DIRECT dans <body> ; seul élément
          affiché pendant l'impression (voir @media print, globals.css) */}
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

function StatBig({ label, value, icon: Icon, highlight }: {
  label: string; value: string;
  icon: React.ComponentType<{ className?: string }>; highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'bg-primary text-primary-foreground border-primary' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <Icon className={`h-5 w-5 ${highlight ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
        </div>
        <p className={`text-xs uppercase tracking-wider font-medium mb-1 ${highlight ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{label}</p>
        <p className="stat-number text-2xl sm:text-3xl">{value}</p>
      </CardContent>
    </Card>
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
