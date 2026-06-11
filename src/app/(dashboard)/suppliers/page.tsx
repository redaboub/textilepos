'use client';

import { useState } from 'react';
import { Plus, Phone, Mail, Edit2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useI18n } from '@/lib/i18n/context';

import { useSuppliers } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import { supplierSchema, type SupplierInput } from '@/lib/validators';
import { formatCurrency, formatPhone } from '@/lib/utils';
import type { Supplier } from '@/types/database';

export default function SuppliersPage() {
  const { t } = useI18n();
  const { data: suppliers, isLoading } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('nav.relations')}</p>
          <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('suppliers.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('suppliers.subtitle')}</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> {t('suppliers.add')}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('suppliers.name')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('suppliers.contact')}</TableHead>
              <TableHead className="text-right">{t('suppliers.total_purchases')}</TableHead>
              <TableHead className="text-right">{t('suppliers.balance_due')}</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6" /></TableCell></TableRow>
              ))
            ) : (suppliers ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{t('suppliers.none')}</TableCell>
              </TableRow>
            ) : (
              (suppliers ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    {s.contact_name && <div className="text-xs text-muted-foreground">{s.contact_name}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {s.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3 shrink-0" /><span dir="ltr">{formatPhone(s.phone)}</span></div>}
                    {s.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3 shrink-0" /><span dir="ltr">{s.email}</span></div>}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.total_purchases, { compact: true })}</TableCell>
                  <TableCell className="text-right">
                    {s.balance > 0 ? (
                      <Badge variant="warning" className="font-mono">{formatCurrency(s.balance)}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon-sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <SupplierFormDialog open={open} onOpenChange={setOpen} supplier={editing} />
    </div>
  );
}

function SupplierFormDialog({ open, onOpenChange, supplier }: { open: boolean; onOpenChange: (v: boolean) => void; supplier: Supplier | null }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierInput>({
    resolver: zodResolver(supplierSchema),
    values: supplier ? {
      name: supplier.name, contact_name: supplier.contact_name, phone: supplier.phone ?? "",
      email: supplier.email, address: supplier.address, tax_id: supplier.tax_id, notes: supplier.notes,
    } : undefined,
  });

  const onSubmit = async (data: SupplierInput) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const payload = { ...data, email: data.email || null };
      const { error } = supplier
        ? await supabase.from('suppliers').update(payload).eq('id', supplier.id)
        : await supabase.from('suppliers').insert(payload);
      if (error) throw error;
      toast.success(supplier ? 'Mis à jour' : 'Créé');
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      reset(); onOpenChange(false);
    } catch (e: any) {
      toast.error('Erreur', { description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{supplier ? t('suppliers.edit') : t('suppliers.new')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label>{t('suppliers.name')} *</Label>
            <Input {...register('name')} className="mt-1.5" />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label>{t('suppliers.contact')}</Label>
            <Input {...register('contact_name')} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('settings.phone')} *</Label>
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                dir="ltr"
                placeholder="0XXXXXXXXX"
                className="mt-1.5"
                {...register('phone')}
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 10); }}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" dir="ltr" {...register('email')} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label>{t('settings.address')}</Label>
            <Input {...register('address')} className="mt-1.5" />
          </div>
          <div>
            <Label>ICE / N° fiscal</Label>
            <Input {...register('tax_id')} className="mt-1.5 font-mono" />
          </div>
          <div>
            <Label>{t('common.notes')}</Label>
            <Textarea {...register('notes')} rows={2} className="mt-1.5" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>{supplier ? 'Mettre à jour' : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
