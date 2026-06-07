'use client';

import Link from 'next/link';
import {
  TrendingUp, ShoppingBag, Package, AlertTriangle, Users, Wallet,
  ArrowUpRight, ArrowDownRight, Layers,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

import type { Profile } from '@/types/database';
import { useI18n } from '@/lib/i18n/context';
import {
  useDashboardStats, useDailySalesChart, useTopProducts,
  useCategoryRevenue, useRealtimeStock, useSales,
} from '@/hooks/use-queries';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  profile: Profile;
}

export function DashboardClient({ profile }: Props) {
  const { t, lang } = useI18n();
  useRealtimeStock();

  const storeId = profile.role === 'super_admin' ? null : profile.store_id;
  const { data: stats, isLoading: statsLoading } = useDashboardStats(storeId);
  const { data: chartData, isLoading: chartLoading } = useDailySalesChart(storeId);
  const { data: topProducts } = useTopProducts(storeId);
  const { data: categoryRevenue } = useCategoryRevenue();
  const { data: recentSales } = useSales({ storeId, limit: 5 });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-none tracking-tight">
            {t('dash.hello')}, {profile.full_name.split(' ')[0]}.
          </h1>
          <p className="text-muted-foreground mt-2">
{t('dash.consolidated')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="lg" variant="outline">
            <Link href="/stock">
              <Layers className="h-4 w-4" /> {t('nav.stock')}
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/pos">
              <ShoppingBag className="h-4 w-4" /> {t('dash.new_sale')}
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('dash.revenue_today_label')}
          value={statsLoading ? null : formatCurrency(stats?.revenue_today ?? 0)}
          subValue={statsLoading ? null : `${stats?.sales_today ?? 0} ${t('dash.sales')}`}
          icon={TrendingUp}
          accent="primary"
          trend={null}
        />
        <StatCard
          label={t('dash.revenue_this_month')}
          value={statsLoading ? null : formatCurrency(stats?.revenue_month ?? 0)}
          subValue={statsLoading ? null : `${stats?.sales_month ?? 0} ${t('dash.sales')}`}
          icon={ShoppingBag}
          accent="success"
        />
        <StatCard
          label={t('dash.active_products')}
          value={statsLoading ? null : formatNumber(stats?.active_rolls ?? 0, 0)}
          subValue={t('dash.in_stock')}
          icon={Package}
          accent="info"
        />
        <StatCard
          label={t('dash.stock_alerts')}
          value={statsLoading ? null : formatNumber(stats?.low_stock_count ?? 0, 0)}
          subValue={t('dash.low_products')}
          icon={AlertTriangle}
          accent={stats && stats.low_stock_count > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Chart - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">{t('dash.revenue_evolution')}</h3>
                <p className="text-sm text-muted-foreground">{t('dash.last_14_days')}</p>
              </div>
              <Badge variant="default">
                <span className="live-dot mr-1.5" /> {t('dash.realtime')}
              </Badge>
            </div>
            {chartLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData ?? []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(234 89% 56%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(234 89% 56%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCurrency(v, { compact: true })}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'CA']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(234 89% 56%)"
                    strokeWidth={2.5}
                    fill="url(#gradRev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-1">{t('dash.top_products')}</h3>
            <p className="text-sm text-muted-foreground mb-5">{t('dash.last_30_days')}</p>
            {!topProducts ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : topProducts.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {t('dash.no_sales')}
              </div>
            ) : (
              <ul className="space-y-3">
                {topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-mono font-semibold shrink-0 bg-muted text-muted-foreground"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(p.meters, 1)} {t('dash.meters_sold')}
                      </div>
                    </div>
                    <div className="text-sm font-mono font-semibold tabular-nums">
                      {formatCurrency(p.revenue, { compact: true })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Répartition du CA par catégorie (remplace le doublon Top produits) */}
        {profile.role === 'super_admin' && (
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg">{t('dash.category_revenue')}</h3>
                  <p className="text-sm text-muted-foreground">{t('dash.last_30_days')}</p>
                </div>
              </div>
              {!categoryRevenue ? (
                <Skeleton className="h-60 w-full" />
              ) : categoryRevenue.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-12">
                  {t('dash.no_sales')}
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ResponsiveContainer width="100%" height={240} className="md:!w-1/2">
                    <PieChart>
                      <Pie
                        data={categoryRevenue}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {categoryRevenue.map((c, i) => (
                          <Cell key={i} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [formatCurrency(value), 'CA']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Légende */}
                  <div className="flex-1 w-full space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                    {categoryRevenue.map((c) => {
                      const totalRev = categoryRevenue.reduce((s, x) => s + x.revenue, 0);
                      const pct = totalRev > 0 ? (c.revenue / totalRev) * 100 : 0;
                      return (
                        <div key={c.name} className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="text-sm font-medium flex-1">{c.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
                          <span className="text-sm font-mono font-semibold tabular-nums w-28 text-right">
                            {formatCurrency(c.revenue)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent sales */}
        <Card className={profile.role === 'super_admin' ? '' : 'lg:col-span-2'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-lg">{t('dash.recent_sales')}</h3>
                <p className="text-sm text-muted-foreground">{t('dash.last_transactions')}</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/pos">{t('nav.new_order')} <ArrowUpRight className="h-3 w-3" /></Link>
              </Button>
            </div>
            {!recentSales ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : recentSales.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {t('dash.no_sales')}
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {recentSales.map((sale) => (
                  <li key={sale.id} className="py-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">
                        {sale.sale_number}
                      </div>
                      <div className="text-sm truncate">
                        {sale.client?.name ?? 'Client de passage'} ·{' '}
                        <span className="text-muted-foreground">
                          {formatRelativeTime(sale.sale_date)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold">
                        {formatCurrency(sale.total)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Side cards if caissier */}
        {profile.role === 'caissier' && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-info/10 text-info flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Clients</div>
                    <div className="stat-number text-2xl">{formatNumber(stats?.clients_count ?? 0, 0)}</div>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('clients.debts_pending')}</div>
                    <div className="stat-number text-2xl">{formatCurrency(stats?.pending_credit ?? 0, { compact: true })}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | null;
  subValue?: string | null;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'primary' | 'success' | 'warning' | 'info';
  trend?: number | null;
}

function StatCard({ label, value, subValue, icon: Icon, accent, trend }: StatCardProps) {
  const accentClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
  };

  return (
    <Card className="group overflow-hidden relative card-glow-hover">
      <div
        className={cn(
          'absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity',
          accent === 'primary' && 'bg-primary',
          accent === 'success' && 'bg-success',
          accent === 'warning' && 'bg-warning',
          accent === 'info' && 'bg-info'
        )}
      />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', accentClasses[accent])}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          {trend != null && (
            <Badge variant={trend >= 0 ? 'success' : 'destructive'} className="font-mono">
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend)}%
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
          {label}
        </p>
        {value == null ? (
          <Skeleton className="h-9 w-24 mb-1" />
        ) : (
          <p className="stat-number text-3xl leading-none tabular-nums">{value}</p>
        )}
        {subValue && <p className="text-xs text-muted-foreground mt-2">{subValue}</p>}
      </CardContent>
    </Card>
  );
}
