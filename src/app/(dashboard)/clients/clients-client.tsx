'use client';

import { useState } from 'react';
import { Plus, Search, Phone, Mail, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { useClients } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { clientSchema, type ClientInput } from '@/lib/validators';
import { formatCurrency, formatPhone } from '@/lib/utils';
import type { Client } from '@/types/database';

export function ClientsClient() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const { data: clients, isLoading } = useClients(search);

  const totalBalance = (clients ?? []).reduce((s, c) => s + Math.max(0, c.balance), 0);
  const totalRevenue = (clients ?? []).reduce((s, c) => s + c.total_purchases, 0);
  const withDebt = (clients ?? []).filter((c) => c.balance > 0).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('nav.relations')}</p>
          <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('clients.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('clients.page_subtitle')}</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> {t('clients.new')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clients.total_clients')}</p>
            <p className="stat-number text-2xl mt-1">{clients?.length ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clients.total_revenue')}</p>
            <p className="stat-number text-2xl mt-1">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clients.debts_pending')}</p>
                <p className="stat-number text-2xl">{formatCurrency(totalBalance, { compact: true })}</p>
                <p className="text-[10px] text-muted-foreground">{withDebt} {t('clients.concerned')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('clients.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.client')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('clients.contact')}</TableHead>
              <TableHead className="text-right">{t('clients.total_purchases')}</TableHead>
              <TableHead className="text-right">{t('clients.debt')}</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6" /></TableCell></TableRow>
              ))
            ) : (clients ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Aucun client. <button className="text-primary underline" onClick={() => setDialogOpen(true)}>Ajouter le premier</button>
                </TableCell>
              </TableRow>
            ) : (
              (clients ?? []).map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {c.tax_id && <div className="text-[11px] text-muted-foreground font-mono">ICE {c.tax_id}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {c.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3 shrink-0" /><span dir="ltr">{formatPhone(c.phone)}</span></div>}
                    {c.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3 shrink-0" /><span dir="ltr">{c.email}</span></div>}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(c.total_purchases, { compact: true })}</TableCell>
                  <TableCell className="text-right">
                    {c.balance > 0 ? (
                      <Badge variant="warning" className="font-mono">{formatCurrency(c.balance)}</Badge>
                    ) : c.balance < 0 ? (
                      <Badge variant="info" className="font-mono">{formatCurrency(c.balance)}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">{t('common.up_to_date')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(c); setDialogOpen(true); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editing}
      />
    </div>
  );
}

function ClientFormDialog({
  open, onOpenChange, client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: Client | null;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    values: client ? {
      name: client.name,
      phone: client.phone ?? "",
      email: client.email,
      address: client.address,
      tax_id: client.tax_id,
      notes: client.notes,
    } : undefined,
  });

  const onSubmit = async (data: ClientInput) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const payload = { ...data, email: data.email || null };
      const { error } = client
        ? await supabase.from('clients').update(payload).eq('id', client.id)
        : await supabase.from('clients').insert(payload);
      if (error) throw error;
      toast.success(client ? 'Client mis à jour' : 'Client créé');
      qc.invalidateQueries({ queryKey: ['clients'] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erreur', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {client ? t('common.edit') : t('clients.new')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="name">{t('clients.name')} *</Label>
            <Input id="name" {...register('name')} className="mt-1.5" />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">{t('clients.phone')} *</Label>
              <Input
                id="phone"
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" dir="ltr" {...register('email')} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="address">{t('clients.address')}</Label>
            <Input id="address" {...register('address')} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="notes">{t('common.notes')}</Label>
            <Textarea id="notes" {...register('notes')} rows={2} className="mt-1.5" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>
              {client ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
