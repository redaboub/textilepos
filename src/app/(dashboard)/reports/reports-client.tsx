'use client';

import { useI18n } from '@/lib/i18n/context';

import { useState, useMemo } from 'react';
import { Download, BarChart3, TrendingUp, Package, AlertTriangle } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

import { useSales, useStores, useTopProducts } from '@/hooks/use-queries';
import { formatCurrency, formatDate, formatMeters } from '@/lib/utils';

export function ReportsClient() {
  const { t } = useI18n();
  const { data: stores } = useStores();
  const today = new Date();
  const monthAgo = new Date(); monthAgo.setDate(today.getDate() - 30);
  const [from, setFrom] = useState(monthAgo.toISOString().split('T')[0]);
  const [to, setTo] = useState(today.toISOString().split('T')[0]);
  const [storeFilter, setStoreFilter] = useState<string>('all');

  const storeId = storeFilter === 'all' ? null : storeFilter;
  const { data: sales, isLoading } = useSales({
    storeId,
    from: new Date(from).toISOString(),
    to: new Date(new Date(to).getTime() + 86400000).toISOString(),
    limit: 1000,
  });
  const { data: topProducts } = useTopProducts(storeId, 10);

  const stats = useMemo(() => {
    const list = sales ?? [];
    const revenue = list.reduce((s, x) => s + x.total, 0);
    const count = list.length;
    const metersSold = list.reduce((s, x) => {
      const m = (x.items ?? []).reduce((ms, it) => ms + (it.meters_sold ?? 0), 0);
      return s + m;
    }, 0);
    const avgTicket = count > 0 ? revenue / count : 0;
    return { revenue, count, metersSold, avgTicket };
  }, [sales]);

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; sales: number }>();
    (sales ?? []).forEach((s) => {
      const key = s.sale_date.split('T')[0];
      const cur = map.get(key) ?? { date: key, revenue: 0, sales: 0 };
      cur.revenue += s.total;
      cur.sales += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short' }),
    }));
  }, [sales]);

  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = (sales ?? []).map((s) => ({
        'N° Vente': s.sale_number,
        'Date': formatDate(s.sale_date),
        'Client': s.client?.name ?? t('common.walk_in'),
        'Caissier': s.cashier?.full_name ?? '—',
        'Sous-total': s.subtotal,
        'Remise': s.discount_amount,
        'TVA': s.tax_amount,
        'Total': s.total,
        'Payé': s.paid_amount,
        'Crédit': s.credit_amount,
        'Mode': s.payment_method,
        'Statut': s.status,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
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

      // ===== En-tête : bandeau navy =====
      doc.setFillColor(...navy);
      doc.rect(0, 0, pageW, 34, 'F');

      // Pastille logo
      doc.setFillColor(...purple);
      doc.roundedRect(14, 9, 16, 16, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('TX', 22, 19.5, { align: 'center' });

      // Titre
      doc.setFontSize(17);
      doc.text('TextilePOS', 35, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(180, 185, 200);
      doc.text('Rapport de ventes', 35, 23);

      // Date de génération (à droite)
      doc.setFontSize(8);
      doc.text(`Généré le ${formatDate(new Date().toISOString())}`, pageW - 14, 14, { align: 'right' });
      doc.text(`Période : ${formatDate(from)} — ${formatDate(to)}`, pageW - 14, 20, { align: 'right' });

      // ===== Cartes de synthèse =====
      const cardY = 44;
      const cardW = (pageW - 28 - 3 * 4) / 4;
      const cards = [
        { label: 'CHIFFRE D\'AFFAIRES', value: formatCurrency(stats.revenue) },
        { label: 'NOMBRE DE VENTES', value: String(stats.count) },
        { label: 'METRAGE VENDU', value: formatMeters(stats.metersSold) },
        { label: 'PANIER MOYEN', value: formatCurrency(stats.avgTicket) },
      ];
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

      // ===== Tableau des ventes =====
      autoTable(doc, {
        startY: cardY + 30,
        head: [['N° Vente', 'Date', 'Client', 'Articles', 'Total']],
        body: (sales ?? []).map((s) => [
          s.sale_number,
          formatDate(s.sale_date),
          s.client?.name ?? 'Client de passage',
          String((s.items ?? []).length),
          formatCurrency(s.total),
        ]),
        styles: { fontSize: 8, cellPadding: 3, textColor: [40, 40, 40], lineColor: [229, 227, 223], lineWidth: 0.1 },
        headStyles: { fillColor: purple, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, halign: 'left' },
        alternateRowStyles: { fillColor: [250, 250, 249] },
        columnStyles: {
          3: { halign: 'center' },
          4: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: () => {
          // Pied de page
          const ph = doc.internal.pageSize.getHeight();
          doc.setFontSize(7);
          doc.setTextColor(...slate);
          doc.setFont('helvetica', 'normal');
          doc.text('TextilePOS — Document généré automatiquement', 14, ph - 8);
          const pageNum = doc.getNumberOfPages();
          doc.text(`Page ${pageNum}`, pageW - 14, ph - 8, { align: 'right' });
        },
      });

      doc.save(`rapport_ventes_${from}_${to}.pdf`);
      toast.success('PDF généré');
    } catch (e: any) {
      toast.error('Erreur d\'export PDF', { description: e.message });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('nav.finance')}</p>
        <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('reports.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('reports.page_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="col-span-2 lg:col-span-1">
            <Label className="mb-1.5 block text-xs">{t('common.from')}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="col-span-2 lg:col-span-1">
            <Label className="mb-1.5 block text-xs">{t('common.to')}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="col-span-2 lg:col-span-1 flex gap-2">
            <Button variant="outline" onClick={exportPDF} className="flex-1">
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" onClick={exportExcel} className="flex-1">
              <Download className="h-4 w-4" /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBig label={t('reports.revenue')} value={formatCurrency(stats.revenue)} icon={TrendingUp} highlight />
        <StatBig label={t('reports.sales_count')} value={String(stats.count)} icon={BarChart3} />
        <StatBig label={t('reports.meters_sold')} value={formatMeters(stats.metersSold)} icon={Package} />
        <StatBig label={t('reports.avg_ticket')} value={formatCurrency(stats.avgTicket)} icon={TrendingUp} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">{t('reports.sales')}</TabsTrigger>
          <TabsTrigger value="evolution">{t('reports.tab_evolution')}</TabsTrigger>
          <TabsTrigger value="products">{t('reports.top_products')}</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reports.sale_number')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.client')}</TableHead>
                  <TableHead className="text-right">{t('common.total')}</TableHead>
                  <TableHead className="text-right">{t('checkout.credit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6" /></TableCell></TableRow>
                  ))
                ) : (sales ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{t('reports.no_sales')}</TableCell></TableRow>
                ) : (
                  (sales ?? []).slice(0, 50).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.sale_number}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(s.sale_date)}</TableCell>
                      <TableCell className="text-sm">{s.client?.name ?? <span className="text-muted-foreground italic">{t('common.walk_in')}</span>}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatCurrency(s.total)}</TableCell>
                      <TableCell className="text-right font-mono text-warning">{s.credit_amount > 0 ? formatCurrency(s.credit_amount) : '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="evolution">
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Évolution des ventes</h3>
              {dailyData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Pas de données.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatCurrency(v, { compact: true })} />
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
              <h3 className="font-semibold mb-4">Produits les plus vendus</h3>
              {!topProducts || topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Pas de données.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.product')}</TableHead>
                      <TableHead className="text-right">Métrage</TableHead>
                      <TableHead className="text-right">{t('reports.revenue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((p, i) => (
                      <TableRow key={p.name}>
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
    </div>
  );
}

function StatBig({ label, value, icon: Icon, highlight }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'bg-primary text-primary-foreground border-primary' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <Icon className={`h-5 w-5 ${highlight ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
        </div>
        <p className={`text-xs uppercase tracking-wider font-medium mb-1 ${highlight ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
          {label}
        </p>
        <p className="stat-number text-3xl">{value}</p>
      </CardContent>
    </Card>
  );
}
