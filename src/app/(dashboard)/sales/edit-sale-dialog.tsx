'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { useProducts } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Sale, Product, PaymentMethod } from '@/types/database';

interface EditLine {
  product_id: string;
  name: string;
  meters: number;
  price_per_meter: number;
  discount_percent: number;
}

export function EditSaleDialog({
  sale, open, onOpenChange, onSaved,
}: {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [lines, setLines] = useState<EditLine[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidInput, setPaidInput] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: products } = useProducts({ search, onlyInStock: false });

  // (Ré)initialiser depuis la vente quand on ouvre
  const [initFor, setInitFor] = useState<string | null>(null);
  if (sale && open && initFor !== sale.id) {
    setLines((sale.items ?? []).map((it) => ({
      product_id: it.product_id ?? it.product?.id ?? '',
      name: it.product?.name ?? '—',
      meters: Number(it.meters_sold ?? 0),
      price_per_meter: Number(it.price_per_meter ?? 0),
      discount_percent: Number(it.discount_percent ?? 0),
    })));
    setMethod(sale.payment_method);
    setPaidInput(String(sale.paid_amount ?? ''));
    setNotes(sale.notes ?? '');
    setInitFor(sale.id);
  }

  const totals = useMemo(() => {
    let gross = 0, itemsDiscount = 0;
    for (const l of lines) {
      const base = l.meters * l.price_per_meter;
      gross += base;
      itemsDiscount += base * (l.discount_percent / 100);
    }
    const subtotal = gross - itemsDiscount;
    const total = subtotal;
    const paid = parseFloat(paidInput) || 0;
    const change = Math.max(0, paid - total);
    const credit = Math.max(0, total - paid);
    return { gross, itemsDiscount, subtotal, total, paid, change, credit };
  }, [lines, paidInput]);

  const setLine = (i: number, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const addProduct = (p: Product) => {
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.product_id === p.id);
      if (existing >= 0) {
        return prev.map((l, idx) => idx === existing ? { ...l, meters: l.meters + 1 } : l);
      }
      return [...prev, {
        product_id: p.id,
        name: p.name,
        meters: 1,
        price_per_meter: p.price || p.default_price_per_meter || 0,
        discount_percent: 0,
      }];
    });
    setPickerOpen(false);
    setSearch('');
  };

  const handleSave = async () => {
    if (lines.length === 0) { toast.error(t('sales.edit_empty')); return; }
    if (lines.some((l) => !l.product_id || l.meters <= 0 || l.price_per_meter < 0)) {
      toast.error(t('sales.edit_empty')); return;
    }
    if (!sale) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const payload = {
        sale_id: sale.id,
        client_id: sale.client_id,
        subtotal: round2(totals.subtotal),
        discount_amount: round2(totals.itemsDiscount),
        tax_amount: 0,
        total: round2(totals.total),
        paid_amount: round2(Math.min(totals.paid, totals.total)),
        change_amount: round2(totals.change),
        credit_amount: round2(totals.credit),
        payment_method: method,
        notes,
        items: lines.map((l) => ({
          product_id: l.product_id,
          meters_sold: l.meters,
          price_per_meter: l.price_per_meter,
          discount_percent: l.discount_percent,
          line_total: round2(l.meters * l.price_per_meter * (1 - l.discount_percent / 100)),
        })),
      };

      const { error } = await supabase.rpc('update_sale', { p: payload });
      if (error) throw error;

      toast.success(t('sales.edit_saved'), { description: sale.sale_number });
      setInitFor(null);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erreur', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setInitFor(null); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* En-tête fixe : titre + total en direct */}
        <DialogHeader className="px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base">
              {t('sales.edit')} {sale ? `· ${sale.sale_number}` : ''}
            </DialogTitle>
            <div className="text-end shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">{t('receipt.total')}</div>
              <div className="font-mono font-bold text-lg text-primary leading-tight">{formatCurrency(totals.total)}</div>
            </div>
          </div>
        </DialogHeader>

        {/* Corps défilable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Lignes — compactes : nom + champs sur une seule ligne */}
          <div className="space-y-2">
            {/* Intitulés de colonnes (une seule fois) */}
            <div className="grid grid-cols-[1fr_72px_84px_64px_36px] gap-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{t('common.product')}</span>
              <span className="text-center">{t('checkout.meters')}</span>
              <span className="text-center">{t('checkout.price')}</span>
              <span className="text-center">%</span>
              <span></span>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="rounded-lg border border-border/60 px-2 py-2">
                <div className="grid grid-cols-[1fr_72px_84px_64px_36px] gap-2 items-center">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{l.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {formatCurrency(l.meters * l.price_per_meter * (1 - l.discount_percent / 100))}
                    </div>
                  </div>
                  <Input
                    className="h-9 px-2 text-center font-mono"
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={l.meters}
                    onChange={(e) => setLine(i, { meters: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    className="h-9 px-2 text-center font-mono"
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={l.price_per_meter}
                    onChange={(e) => setLine(i, { price_per_meter: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    className="h-9 px-2 text-center font-mono"
                    type="number" inputMode="decimal" min="0" max="100" step="1"
                    value={l.discount_percent}
                    onChange={(e) => setLine(i, { discount_percent: parseFloat(e.target.value) || 0 })}
                  />
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => removeLine(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Ajouter un article */}
          {pickerOpen ? (
            <div className="rounded-lg border border-border/60 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus className="pl-9 h-9"
                    placeholder={t('pos.search_product')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setPickerOpen(false); setSearch(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="max-h-44 overflow-y-auto divide-y divide-border/60">
                {(products ?? []).slice(0, 30).map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-start py-2 px-1 hover:bg-accent/50 rounded flex justify-between items-center gap-2"
                    onClick={() => addProduct(p)}
                  >
                    <span className="text-sm truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {formatNumber(p.stock_meters, 0)} m · {formatCurrency(p.price || p.default_price_per_meter)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setPickerOpen(true)}>
              <Plus className="h-4 w-4" /> {t('sales.edit_add')}
            </Button>
          )}

          {/* Paiement + Notes sur une ligne */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">{t('checkout.payment_method')}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('checkout.cash')}</SelectItem>
                  <SelectItem value="check">{t('checkout.check')}</SelectItem>
                  <SelectItem value="transfer">{t('checkout.transfer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">{t('checkout.paid')}</Label>
              <Input
                className="h-9 font-mono"
                type="number" inputMode="decimal" min="0" step="0.01"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Notes</Label>
            <Textarea rows={1} className="min-h-[38px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Totaux compacts */}
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('receipt.subtotal')}</span>
              <span className="font-mono whitespace-nowrap">{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.itemsDiscount > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('receipt.discount')}</span>
                <span className="font-mono whitespace-nowrap">−{formatCurrency(totals.itemsDiscount)}</span>
              </div>
            )}
            {totals.credit > 0 && (
              <div className="flex items-center justify-between gap-3 text-warning">
                <span>{t('checkout.credit')}</span>
                <span className="font-mono whitespace-nowrap">{formatCurrency(totals.credit)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pied fixe : boutons toujours visibles */}
        <DialogFooter className="px-5 py-3 border-t border-border/60 shrink-0 flex-row gap-2 sm:justify-end bg-background">
          <Button variant="ghost" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={handleSave} loading={loading} disabled={lines.length === 0}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
