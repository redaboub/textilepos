'use client';

import { useI18n } from '@/lib/i18n/context';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCog, Shield, ShieldCheck, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { createClient } from '@/lib/supabase/client';
import { useStores } from '@/hooks/use-queries';
import { formatDate, cn } from '@/lib/utils';
import type { Profile } from '@/types/database';

export function UsersClient() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Profile | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<Profile[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*, store:stores(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });

  const toggleActive = async (user: Profile) => {
    // Le super admin ne peut pas désactiver son propre compte
    if (user.id === currentUserId && user.is_active) {
      toast.error('Action impossible', { description: 'Vous ne pouvez pas désactiver votre propre compte.' });
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);
    if (error) { toast.error('Erreur', { description: error.message }); return; }
    toast.success(user.is_active ? 'Compte désactivé' : 'Compte activé');
    qc.invalidateQueries({ queryKey: ['users'] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('nav.administration')}</p>
          <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('users.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('users.page_subtitle')}
          </p>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('users.name')}</TableHead>
              <TableHead>{t('users.role')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('users.last_login')}</TableHead>
              <TableHead>{t('users.status')}</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10" /></TableCell></TableRow>
              ))
            ) : (
              (users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">
                          {u.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{u.full_name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.role === 'super_admin' ? (
                      <Badge variant="default" className="gap-1">
                        <ShieldCheck className="h-3 w-3" /> {t('topbar.super_admin')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t('topbar.cashier')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {u.last_login_at ? formatDate(u.last_login_at) : 'Jamais'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={u.is_active} onCheckedChange={() => toggleActive(u)} disabled={u.id === currentUserId} />
                      <span className={cn('text-xs', u.is_active ? 'text-success' : 'text-muted-foreground')}>
                        {u.is_active ? t('users.active') : t('users.inactive')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditing(u)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <EditUserDialog user={editing} onOpenChange={(v) => !v && setEditing(null)} />
    </div>
  );
}

function EditUserDialog({ user, onOpenChange }: { user: Profile | null; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: stores } = useStores();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'super_admin' | 'caissier'>('caissier');
  const [storeId, setStoreId] = useState<string>('');

  // Sync form state when user changes
  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhone(user.phone ?? '');
      setRole(user.role);
      setStoreId(user.store_id ?? '');
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('profiles').update({
        full_name: fullName,
        phone: phone || null,
        role,
        store_id: role === 'super_admin' ? null : (storeId || null),
      }).eq('id', user.id);
      if (error) throw error;
      toast.success('Utilisateur mis à jour');
      qc.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erreur', { description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Modifier l&apos;utilisateur</DialogTitle>
        </DialogHeader>
        {user && (
          <div className="space-y-3">
            <div>
              <Label>{t('users.email')}</Label>
              <Input value={user.email} disabled className="mt-1.5" />
            </div>
            <div>
              <Label>Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>{t('users.role')}</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">{t('topbar.super_admin')}</SelectItem>
                  <SelectItem value="caissier">{t('topbar.cashier')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === 'caissier' && (
              <div>
                <Label>{t('settings.store')}</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {(stores ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button onClick={handleSubmit} loading={loading}>Mettre à jour</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
