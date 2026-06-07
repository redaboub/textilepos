'use client';

import { useState, useMemo } from 'react';
import { Plus, FileCheck2, Edit2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n/context';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { useChecks, useStores } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import { checkSchema, type CheckInput } from '@/lib/validators';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Profile, Check, CheckStatus } from '@/types/database';

interface Props {
  profile: Profile;
}

export function ChecksClient({ profile }: Props) {
  const { t } = useI18n();
  const storeId = profile.role === 'super_admin' ? null : profile.store_id;
  const { data: checks, isLoading } = useChecks({ storeId });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Check | null>(null);
  const [tab, setTab] = useState<'all' | 'incoming' | 'outgoing'>('all');

  const filtered = useMemo(() => {
    if (!checks) return [];
    if (tab === 'all') return checks;
    return checks.filter((c) => c.type === tab);
  }, [checks, tab]);

  const stats = useMemo(() => {
    const list = checks ?? [];
    const pending = list.filter((c) => c.status === 'pending');
    const incomingPending = pending.filter((c) => c.type === 'incoming').reduce((s, c) => s + c.amount, 0);
    const outgoingPending = pending.filter((c) => c.type === 'outgoing').reduce((s, c) => s + c.amount, 0);
    const overdue = pending.filter((c) => new Date(c.due_date) < new Date()).length;
    return { incomingPending, outgoingPending, overdue, total: list.length };
  }, [checks]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('nav.finance')}</p>
          <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('checks.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('checks.subtitle')}</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> {t('checks.new')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox label={t('checks.to_cash')} value={formatCurrency(stats.incomingPending)} icon={ArrowDownLeft} accent="success" />
        <StatBox label={t('checks.to_pay')} value={formatCurrency(stats.outgoingPending)} icon={ArrowUpRight} accent="warning" />
        <StatBox label={t('checks.overdue')} value={String(stats.overdue)} icon={FileCheck2} accent={stats.overdue > 0 ? 'destructive' : 'info'} />
        <StatBox label={t('common.total')} value={String(stats.total)} icon={FileCheck2} accent="info" />
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList>
          <TabsTrigger value="all">{t('checks.tab_all')}</TabsTrigger>
          <TabsTrigger value="incoming">{t('checks.tab_in')}</TabsTrigger>
          <TabsTrigger value="outgoing">{t('checks.tab_out')}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('checks.type')}</TableHead>
                  <TableHead>{t('checks.number')}</TableHead>
                  <TableHead>{t('checks.issuer')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('checks.bank')}</TableHead>
                  <TableHead className="text-right">{t('common.amount')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('checks.due_date')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6" /></TableCell></TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">{t('checks.none')}</TableCell></TableRow>
                ) : (
                  filtered.map((c) => {
                    const overdue = c.status === 'pending' && new Date(c.due_date) < new Date();
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className={cn(
                            'flex items-center gap-1.5 text-xs font-medium',
                            c.type === 'incoming' ? 'text-success' : 'text-warning'
                          )}>
                            {c.type === 'incoming' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            {c.type === 'incoming' ? 'Entrant' : 'Sortant'}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{c.check_number}</TableCell>
                        <TableCell className="text-sm">{c.issuer_name}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.bank_name ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(c.amount)}</TableCell>
                        <TableCell className={cn('hidden md:table-cell text-sm', overdue && 'text-destructive font-medium')}>
                          {formatDate(c.due_date)}
                        </TableCell>
                        <TableCell><StatusBadge status={c.status} overdue={overdue} /></TableCell>
                        <TableCell className="text-right">
                          <Button size="icon-sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <CheckFormDialog open={open} onOpenChange={setOpen} check={editing} profile={profile} />
    </div>
  );
}

function StatusBadge({ status, overdue }: { status: CheckStatus; overdue: boolean }) {
  const { t } = useI18n();
  if (overdue && status === 'pending') return <Badge variant="destructive">En retard</Badge>;
  const map: Record<CheckStatus, { label: string; variant: any }> = {
    pending: { label: t('checks.pending'), variant: 'warning' },
    paid: { label: 'Payé', variant: 'success' },
    rejected: { label: t('checks.bounced'), variant: 'destructive' },
    cancelled: { label: 'Annulé', variant: 'secondary' },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function StatBox({ label, value, icon: Icon, accent }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'success' | 'warning' | 'destructive' | 'info';
}) {
  const colors = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    info: 'bg-info/10 text-info',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', colors[accent])}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="stat-number text-2xl">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckFormDialog({ open, onOpenChange, check, profile }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  check: Check | null;
  profile: Profile;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: stores } = useStores();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CheckInput>({
    resolver: zodResolver(checkSchema),
    values: check ? {
      store_id: check.store_id, type: check.type, check_number: check.check_number,
      bank_name: check.bank_name, issuer_name: check.issuer_name,
      client_id: check.client_id, supplier_id: check.supplier_id,
      amount: check.amount, issue_date: check.issue_date, due_date: check.due_date, notes: check.notes,
    } : {
      store_id: profile.store_id ?? '',
      type: 'incoming',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
    } as any,
  });

  const onSubmit = async (data: CheckInput) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const payload = {
        ...data,
        store_id: profile.store_id,
        created_by: profile.id,
        client_id: data.client_id || null,
        supplier_id: data.supplier_id || null,
      };
      const { error } = check
        ? await supabase.from('checks').update(payload).eq('id', check.id)
        : await supabase.from('checks').insert(payload);
      if (error) throw error;
      toast.success(check ? 'Chèque mis à jour' : 'Chèque enregistré');
      qc.invalidateQueries({ queryKey: ['checks'] });
      reset(); onOpenChange(false);
    } catch (e: any) {
      toast.error('Erreur', { description: e.message });
    } finally { setLoading(false); }
  };

  const updateStatus = async (status: CheckStatus) => {
    if (!check) return;
    const supabase = createClient();
    const { error } = await supabase.from('checks').update({ status }).eq('id', check.id);
    if (error) { toast.error('Erreur', { description: error.message }); return; }
    toast.success('Statut mis à jour');
    qc.invalidateQueries({ queryKey: ['checks'] });
    onOpenChange(false);
  };

  const isAdmin = profile.role === 'super_admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{check ? t('common.edit') : t('checks.new')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('checks.type')} *</Label>
              <Select onValueChange={(v: any) => setValue('type', v)} defaultValue={check?.type ?? 'incoming'}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">Entrant (à encaisser)</SelectItem>
                  <SelectItem value="outgoing">Sortant (à payer)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('checks.number')} *</Label>
              <Input {...register('check_number')} className="mt-1.5 font-mono" />
              {errors.check_number && <p className="text-xs text-destructive">{errors.check_number.message}</p>}
            </div>
          </div>

          <div>
            <Label>{t('checks.issuer')} *</Label>
            <Input {...register('issuer_name')} className="mt-1.5" placeholder="Nom du tiré / bénéficiaire" />
            {errors.issuer_name && <p className="text-xs text-destructive mt-1">{errors.issuer_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('checks.bank')}</Label>
              <Input {...register('bank_name')} className="mt-1.5" />
            </div>
            <div>
              <Label>{t('common.amount')} *</Label>
              <Input type="number" step="0.01" {...register('amount')} className="mt-1.5 font-mono" />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('checks.issue_date')} *</Label>
              <Input type="date" {...register('issue_date')} className="mt-1.5" />
            </div>
            <div>
              <Label>{t('checks.due_date')} *</Label>
              <Input type="date" {...register('due_date')} className="mt-1.5" />
            </div>
          </div>

          {/* Magasin unique : assigné automatiquement */}

          <div>
            <Label>{t('common.notes')}</Label>
            <Textarea {...register('notes')} rows={2} className="mt-1.5" />
          </div>

          {check && check.status === 'pending' && (
            <div className="flex gap-2 p-3 bg-muted/30 rounded-lg">
              <Button type="button" size="sm" variant="success" onClick={() => updateStatus('paid')}>
                Marquer comme payé
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => updateStatus('rejected')}>
                Marquer rejeté
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => updateStatus('cancelled')}>
                Annuler
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>{check ? 'Mettre à jour' : 'Enregistrer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
