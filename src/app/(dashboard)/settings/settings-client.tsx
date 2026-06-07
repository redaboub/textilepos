'use client';

import { useI18n } from '@/lib/i18n/context';
import { useState } from 'react';
import { Building2, Save, Receipt as ReceiptIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';

import { useStores } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import type { Store } from '@/types/database';

export function SettingsClient() {
  const { t } = useI18n();
  const { data: stores, isLoading } = useStores();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">{t('nav.administration')}</p>
        <h1 className="font-display text-3xl sm:text-4xl leading-none">{t('settings.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('settings.page_subtitle')}</p>
      </div>

      <Tabs defaultValue="stores">
        <TabsList>
          <TabsTrigger value="stores">{t('settings.store')}</TabsTrigger>
          <TabsTrigger value="receipt">{t('settings.printing')}</TabsTrigger>
          <TabsTrigger value="general">{t('settings.general')}</TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            (stores ?? []).map((s) => <StoreCard key={s.id} store={s} />)
          )}
        </TabsContent>

        <TabsContent value="receipt">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Paramètres du ticket de caisse</h3>
              <div>
                <Label>{t('settings.thank_you_msg')}</Label>
                <Input defaultValue="Merci de votre visite !" className="mt-1.5" />
              </div>
              <div>
                <Label>{t('settings.print_width')}</Label>
                <select defaultValue="80mm" className="mt-1.5 w-full h-11 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="58mm">58 mm</option>
                  <option value="80mm">80 mm</option>
                </select>
              </div>
              <Button>
                <Save className="h-4 w-4" /> {t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <GeneralCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StoreCard({ store }: { store: Store }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(store.name);
  const [address, setAddress] = useState(store.address ?? '');
  const [phone, setPhone] = useState(store.phone ?? '');
  const [email, setEmail] = useState(store.email ?? '');
  const [taxId, setTaxId] = useState(store.tax_id ?? '');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('stores').update({
        name, address: address || null, phone: phone || null,
        email: email || null, tax_id: taxId || null,
      }).eq('id', store.id);
      if (error) throw error;
      toast.success('Magasin mis à jour');
      qc.invalidateQueries({ queryKey: ['stores'] });
    } catch (e: any) {
      toast.error('Erreur', { description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">{store.name}</h3>
            <p className="text-xs text-muted-foreground font-mono">{store.id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>{t('settings.store_name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div className="md:col-span-2">
            <Label>{t('settings.address')}</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="mt-1.5" />
          </div>
          <div>
            <Label>{t('settings.phone')}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1.5" />
          </div>
          <div className="md:col-span-2">
            <Label>{t('settings.tax_id')}</Label>
            <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="mt-1.5 font-mono" />
          </div>
        </div>

        <Button onClick={save} loading={loading} className="mt-4">
          <Save className="h-4 w-4" /> {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

// Préférences générales fonctionnelles : seuil de stock faible appliqué à tous les produits
function GeneralCard() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState('50');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const v = parseFloat(threshold);
    if (isNaN(v) || v < 0) {
      toast.error(t('common.error'), { description: t('settings.low_threshold') });
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      // Applique le seuil à tous les produits actifs
      const { error } = await supabase
        .from('products')
        .update({ low_stock_threshold: v })
        .eq('is_active', true);
      if (error) throw error;
      toast.success(t('common.save'));
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (e: any) {
      toast.error(t('common.error'), { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h3 className="font-semibold">{t('settings.general')}</h3>
        <div className="max-w-xs">
          <Label>{t('settings.low_threshold')}</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="mt-1.5 font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {t('settings.threshold_hint')}
          </p>
        </div>
        <Button onClick={save} loading={loading}>
          <Save className="h-4 w-4" /> {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
