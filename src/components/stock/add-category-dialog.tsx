'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = ['#5645d4', '#dd5b00', '#2a9d99', '#ff64c8', '#0075de', '#1aae39', '#e11d48', '#9333ea'];

export function AddCategoryDialog({ open, onOpenChange }: AddCategoryDialogProps) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nom de catégorie requis'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('categories').insert({
        name: name.trim().toUpperCase(),
        description: `Catégorie ${name.trim().toUpperCase()}`,
        color,
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('Cette catégorie existe déjà');
          setLoading(false);
          return;
        }
        throw error;
      }
      toast.success('Catégorie créée', { description: name.trim().toUpperCase() });
      qc.invalidateQueries({ queryKey: ['categories'] });
      setName('');
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
          <DialogTitle className="font-display text-2xl">{t('category.new_title')}</DialogTitle>
          <DialogDescription>Créez une catégorie pour organiser vos articles.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t('category.name')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: PREMIUM"
              className="mt-1.5 uppercase"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          <div>
            <Label>{t('category.color')}</Label>
            <div className="flex gap-2 mt-1.5 flex-wrap items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-transform"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#000' : 'transparent',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                  aria-label={`Couleur ${c}`}
                />
              ))}
              {/* Sélecteur de couleur personnalisé (crayon) */}
              <label
                className="relative w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                style={!PRESET_COLORS.includes(color) ? { backgroundColor: color, borderStyle: 'solid', borderColor: '#000' } : undefined}
                title={t('category.custom_color')}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" style={!PRESET_COLORS.includes(color) ? { color: '#fff', mixBlendMode: 'difference' } : undefined} />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label={t('category.custom_color')}
                />
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} loading={loading}>{t('category.create')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
