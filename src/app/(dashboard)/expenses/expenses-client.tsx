'use client';

import { useState, useMemo } from 'react';
import { Plus, Wallet, Edit2 } from 'lucide-react';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useI18n } from '@/lib/i18n/context';

import { useExpenses, useExpenseCategories, useStores } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import { expenseSchema, type ExpenseInput } from '@/lib/validators';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Profile, Expense } from '@/types/database';

interface Props {
  profile: Profile;
}

export function ExpensesClient({ profile }: Props) {
  const { t } = useI18n();
  const storeId = profile.role === 'super_admin' ? null : profile.store_id;
  const { data: expenses, isLoading } = useExpenses({ storeId });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const stats = useMemo(() => {
    const list = expenses ?? [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const todayTotal = list
      .filter((e) => new Date(e.expense_date) >= today)
      .reduce((s, e) => s + e.amount, 0);
    const monthTotal = list
      .filter((e) => new Date(e.expense_date) >= monthStart)
      .reduce((s, e) => s + e.amount, 0);
    return { todayTotal, monthTotal, count: list.length };
  }, [expenses]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">Finance</p>
          <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('expenses.title')}</h1>
          <p className="text-muted-foreground mt-2">Suivi des charges quotidiennes du magasin.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Nouvelle dépense
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Aujourd&apos;hui</p>
            <p className="stat-number text-2xl mt-1">{formatCurrency(stats.todayTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ce mois</p>
            <p className="stat-number text-2xl mt-1">{formatCurrency(stats.monthTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('expenses.total')}</p>
                <p className="stat-number text-2xl">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead>{t('expenses.label')}</TableHead>
              <TableHead>{t('common.category')}</TableHead>
              <TableHead className="text-right">{t('common.amount')}</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6" /></TableCell></TableRow>
              ))
            ) : (expenses ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{t('expenses.none')}</TableCell></TableRow>
            ) : (
              (expenses ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(e.expense_date)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{e.description}</div>
                    {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                  </TableCell>
                  <TableCell>
                    {e.category ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${e.category.color}20`,
                          color: e.category.color,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: e.category.color }} />
                        {e.category.name}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatCurrency(e.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon-sm" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <ExpenseFormDialog open={open} onOpenChange={setOpen} expense={editing} profile={profile} />
    </div>
  );
}

function ExpenseFormDialog({ open, onOpenChange, expense, profile }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense: Expense | null;
  profile: Profile;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: categories } = useExpenseCategories();
  const { data: stores } = useStores();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    values: expense ? {
      store_id: expense.store_id,
      category_id: expense.category_id,
      description: expense.description,
      amount: expense.amount,
      payment_method: expense.payment_method as any,
      expense_date: expense.expense_date.split('T')[0],
      notes: expense.notes,
    } : {
      store_id: profile.store_id ?? '',
      payment_method: 'cash',
      expense_date: new Date().toISOString().split('T')[0],
    } as any,
  });

  const onSubmit = async (data: ExpenseInput) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const payload = {
        ...data,
        store_id: profile.store_id, // magasin unique, assigné automatiquement
        created_by: profile.id,
        category_id: data.category_id || null,
      };
      const { error } = expense
        ? await supabase.from('expenses').update(payload).eq('id', expense.id)
        : await supabase.from('expenses').insert(payload);
      if (error) throw error;
      toast.success(expense ? t('expenses.updated') : t('expenses.recorded'));
      qc.invalidateQueries({ queryKey: ['expenses'] });
      reset(); onOpenChange(false);
    } catch (e: any) {
      toast.error('Erreur', { description: e.message });
    } finally { setLoading(false); }
  };

  const isAdmin = profile.role === 'super_admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{expense ? t('common.edit') : t('expenses.new')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label>{t('expenses.label')} *</Label>
            <Input {...register('description')} className="mt-1.5" placeholder={t('expenses.example_label')} />
            {errors.description && <p className="text-xs text-destructive mt-1">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('common.amount')} *</Label>
              <Input type="number" step="0.01" {...register('amount')} className="mt-1.5 font-mono" />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div>
              <Label>{t('common.date')} *</Label>
              <Input type="date" {...register('expense_date')} className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('common.category')}</Label>
              <Select onValueChange={(v) => setValue('category_id', v === 'none' ? null : v)} defaultValue={expense?.category_id ?? 'none'}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('expenses.payment_method')}</Label>
              <Select onValueChange={(v: any) => setValue('payment_method', v)} defaultValue={expense?.payment_method ?? 'cash'}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="card">Carte</SelectItem>
                  <SelectItem value="check">Chèque</SelectItem>
                  <SelectItem value="transfer">Virement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Magasin unique : assigné automatiquement, plus de sélecteur */}

          <div>
            <Label>{t('common.notes')}</Label>
            <Textarea {...register('notes')} rows={2} className="mt-1.5" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>{expense ? 'Mettre à jour' : 'Enregistrer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
