'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Ajoute un nouvel article au référentiel.
 * Champs : catégorie, nom produit, prix. Stock initial 0.
 */
export function AddProductDialog({ open, onOpenChange }: AddProductDialogProps) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { data: categories } = useCategories();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setName(''); setCategoryId(''); setPrice(''); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nom du produit requis'); return; }
    if (!categoryId) { toast.error('Catégorie requise'); return; }
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) { toast.error('Prix invalide'); return; }

    setLoading(true);
    try {
      const supabase = createClient();
      const code = name.trim().toUpperCase().replace(/\s+/g, '');
      const { error } = await supabase.from('products').insert({
        name: name.trim(),
        product_code: code,
        sku: code,
        category_id: categoryId,
        price: p,
        default_price_per_meter: p,
        stock_meters: 0,
        low_stock_threshold: 50,
        is_active: true,
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('Ce produit existe déjà', { description: `Le code "${code}" est déjà utilisé.` });
          setLoading(false);
          return;
        }
        throw error;
      }
      toast.success('Article ajouté au référentiel', { description: name.trim() });
      qc.invalidateQueries({ queryKey: ['products'] });
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
          <DialogTitle className="font-display text-2xl">{t('products.new_article')}</DialogTitle>
          <DialogDescription>{t('products.add_subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t('common.category')}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder={t('products.choose_category')} /></SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('products.name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: KARMA21" className="mt-1.5" />
          </div>

          <div>
            <Label>{t('products.price_dh')}</Label>
            <Input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="ex: 120" className="mt-1.5 font-mono" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} loading={loading}>{t('common.add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
