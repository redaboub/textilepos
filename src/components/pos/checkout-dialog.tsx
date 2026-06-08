'use client';

import { useState, useEffect } from 'react';
import { Banknote, FileText, ArrowRightLeft, CheckCircle2, Printer, User, UserCheck, UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatCurrency } from '@/lib/utils';
import { usePOSStore } from '@/store/pos';
import { useClients } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import type { Profile, PaymentMethod, Sale } from '@/types/database';
import { createPortal } from 'react-dom';
import { Receipt } from './receipt';
import { printReceipt } from '@/lib/print';
import { useI18n } from '@/lib/i18n/context';

const PAYMENT_OPTIONS: { value: PaymentMethod; labelKey: any; icon: any }[] = [
  { value: 'cash', labelKey: 'checkout.cash', icon: Banknote },
  { value: 'check', labelKey: 'checkout.check', icon: FileText },
  { value: 'transfer', labelKey: 'checkout.transfer', icon: ArrowRightLeft },
];

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
}

export function CheckoutDialog({ open, onOpenChange, profile }: CheckoutDialogProps) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const items = usePOSStore((s) => s.items);
  const clientId = usePOSStore((s) => s.clientId);
  const clientName = usePOSStore((s) => s.clientName);
  const setClient = usePOSStore((s) => s.setClient);
  const [clientSearch, setClientSearch] = useState('');
  const { data: clients } = useClients(clientSearch);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const subtotalAfterItemDiscount = usePOSStore((s) => s.subtotal());
  const itemsDiscount = usePOSStore((s) => s.itemsDiscount());
  const globalDiscountAmount = usePOSStore((s) => s.globalDiscountAmount());
  const taxAmount = usePOSStore((s) => s.taxAmount());
  const total = usePOSStore((s) => s.total());
  const notes = usePOSStore((s) => s.notes);
  const clear = usePOSStore((s) => s.clear);

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidInput, setPaidInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [ticketMode, setTicketMode] = useState<'client' | 'magasin'>('client');

  // Champs chèque (quand paiement par chèque)
  const [checkNumber, setCheckNumber] = useState('');
  const [checkBank, setCheckBank] = useState('');
  const [checkIssuer, setCheckIssuer] = useState('');
  const [checkDueDate, setCheckDueDate] = useState('');

  const paid = parseFloat(paidInput) || 0;
  const change = Math.max(0, paid - total);
  const credit = Math.max(0, total - paid);

  // Tant que l'écran de succès est affiché, on marque le <body> :
  // n'importe quelle impression (bouton de l'app OU impression navigateur/tablette)
  // n'imprimera alors que le reçu, sur une seule page.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (completedSale) document.body.classList.add('has-receipt');
    else document.body.classList.remove('has-receipt');
    return () => document.body.classList.remove('has-receipt');
  }, [completedSale]);

  const handleCreateClient = async () => {
    const name = newClientName.trim();
    const phone = newClientPhone.replace(/\D/g, '');
    if (name.length < 2) {
      toast.error(t('clients.name_required'));
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      toast.error(t('clients.phone_invalid'));
      return;
    }
    setCreatingClient(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .insert({ name, phone })
        .select('*')
        .single();
      if (error) throw error;
      // Sélectionne le nouveau client et rafraîchit la liste
      setClient(data.id, data.name);
      await qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(t('clients.created'));
      setShowNewClient(false);
      setNewClientName('');
      setNewClientPhone('');
    } catch (e: any) {
      toast.error(t('common.error'), { description: e.message });
    } finally {
      setCreatingClient(false);
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    // Vérif stock + prix
    for (const it of items) {
      if (it.meters > it.product.stock_meters) {
        toast.error(t('checkout.insufficient_stock'), { description: `${it.product.name} : ${it.product.stock_meters} m` });
        return;
      }
      if (it.meters <= 0) {
        toast.error(t('movement.quantity_required'), { description: it.product.name });
        return;
      }
      if (!it.price_per_meter || it.price_per_meter <= 0) {
        toast.error(t('movement.price_required'), { description: it.product.name });
        return;
      }
    }

    // Montant reçu obligatoire
    if (!paidInput || paid <= 0) {
      toast.error(t('checkout.amount_required'));
      return;
    }

    // Si paiement par chèque : champs chèque obligatoires
    if (method === 'check') {
      if (!checkNumber.trim() || !checkBank.trim() || !checkIssuer.trim() || !checkDueDate) {
        toast.error(t('checkout.check_fields_required'));
        return;
      }
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Création ATOMIQUE de la vente (en-tête + articles + stock + chèque)
      // dans une seule transaction côté base : tout réussit, ou rien.
      // Plus de vente partielle possible, et un seul aller-retour réseau.
      const payload = {
        store_id: profile.store_id,
        client_id: clientId,
        client_name: clientName || null,
        subtotal: subtotalAfterItemDiscount,
        discount_amount: globalDiscountAmount + itemsDiscount,
        tax_amount: taxAmount,
        total,
        paid_amount: Math.min(paid, total),
        change_amount: change,
        credit_amount: credit,
        payment_method: method,
        notes,
        items: items.map((it) => ({
          product_id: it.product.id,
          meters_sold: it.meters,
          price_per_meter: it.price_per_meter,
          discount_percent: it.discount_percent,
          line_total: it.meters * it.price_per_meter * (1 - it.discount_percent / 100),
        })),
        check: method === 'check' ? {
          check_number: checkNumber.trim(),
          bank_name: checkBank.trim(),
          issuer_name: checkIssuer.trim(),
          due_date: checkDueDate,
        } : null,
      };

      const { data: newSaleId, error: createErr } = await supabase.rpc('create_sale', { p: payload });
      if (createErr) throw createErr;

      // Récupérer la vente complète (magasin / caissier / client) pour le ticket
      const { data: sale, error: fetchErr } = await supabase
        .from('sales')
        .select('*, store:stores(*), cashier:profiles!sales_cashier_id_fkey(*), client:clients(*)')
        .eq('id', newSaleId)
        .single();
      if (fetchErr) throw fetchErr;
      const saleNumber = sale.sale_number as string;

      // Construire l'objet vente complet pour le ticket
      const fullSale: Sale = {
        ...(sale as any),
        items: items.map((it) => ({
          id: '', sale_id: sale.id, roll_id: null, product_id: it.product.id,
          item_type: 'meter', meters_sold: it.meters, price_per_meter: it.price_per_meter,
          discount_percent: it.discount_percent,
          line_total: it.meters * it.price_per_meter * (1 - it.discount_percent / 100),
          remaining_after_sale: 0, created_at: new Date().toISOString(),
          product: it.product,
        })),
      };

      toast.success('Vente enregistrée', { description: saleNumber });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setCompletedSale(fullSale);
    } catch (e: any) {
      toast.error('Erreur lors de l\'enregistrement', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    clear();
    setCompletedSale(null);
    setPaidInput('');
    setMethod('cash');
    setCheckNumber('');
    setCheckBank('');
    setCheckIssuer('');
    setCheckDueDate('');
    onOpenChange(false);
  };

  const handlePrint = (mode: 'client' | 'magasin') => {
    setTicketMode(mode);
    // Laisser React rendre le bon ticket avant d'imprimer
    setTimeout(() => printReceipt(), 60);
  };

  // Vue succès + tickets
  if (completedSale) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && handleFinish()}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="h-16 w-16 rounded-full bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-2xl mb-1">{t('checkout.success')}</h3>
              <p className="text-muted-foreground text-sm">
                {completedSale.sale_number} · {formatCurrency(completedSale.total)}
              </p>
            </div>

            {/* Ticket imprimable — rendu directement dans <body> via un portail,
                pour qu'il sorte de la fenêtre (Dialog) et s'imprime sur UNE seule page */}
            {typeof window !== 'undefined' &&
              createPortal(
                <div className="printable">
                  <Receipt sale={completedSale} variant={ticketMode} />
                </div>,
                document.body,
              )}

            <div className="flex flex-col gap-2 w-full pt-4">
              <Button onClick={() => handlePrint('client')} size="lg" className="w-full">
                <Printer className="h-4 w-4" /> {t('checkout.ticket_client')}
              </Button>
              <Button onClick={() => handlePrint('magasin')} size="lg" variant="outline" className="w-full">
                <Printer className="h-4 w-4" /> {t('checkout.ticket_store')}
              </Button>
              <Button onClick={handleFinish} variant="ghost" size="lg" className="w-full">
                {t('checkout.new_order')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{t('checkout.title')}</DialogTitle>
          <DialogDescription>{t('checkout.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border p-4 space-y-1.5 bg-muted/20">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Articles</span>
            <span>{items.length}</span>
          </div>
          {itemsDiscount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Remises lignes</span>
              <span className="text-success font-mono">−{formatCurrency(itemsDiscount)}</span>
            </div>
          )}
          {globalDiscountAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Remise globale</span>
              <span className="text-success font-mono">−{formatCurrency(globalDiscountAmount)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">TVA</span>
              <span className="font-mono">+{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-1.5 border-t">
            <span>Total</span>
            <span className="font-mono text-lg">{formatCurrency(total)}</span>
          </div>
        </div>

        <div>
          <Label className="text-sm mb-2 block">{t('pos.choose_client')}</Label>
          <div className="rounded-xl border p-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('pos.search_client')}
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9 rtl:pl-3 rtl:pr-9 h-9"
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              <button
                type="button"
                onClick={() => setClient(null, null)}
                className={cn('w-full text-start rounded-lg p-2 border text-sm transition-colors flex items-center gap-2',
                  !clientId ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')}
              >
                <User className="h-4 w-4 shrink-0" />
                {t('common.walk_in')}
              </button>
              {(clients ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClient(c.id, c.name)}
                  className={cn('w-full text-start rounded-lg p-2 border text-sm transition-colors flex items-center justify-between gap-2',
                    clientId === c.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <UserCheck className="h-4 w-4 shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </span>
                  {c.phone && <span dir="ltr" className="text-xs text-muted-foreground shrink-0">{c.phone}</span>}
                </button>
              ))}
            </div>

            {/* Création rapide d'un nouveau client */}
            {!showNewClient ? (
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowNewClient(true)}>
                <UserPlus className="h-4 w-4" /> {t('clients.new')}
              </Button>
            ) : (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                <div>
                  <Label htmlFor="nc_name" className="text-xs">{t('clients.name')} *</Label>
                  <Input id="nc_name" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="mt-1 h-9" />
                </div>
                <div>
                  <Label htmlFor="nc_phone" className="text-xs">{t('clients.phone')} *</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <span dir="ltr" className="shrink-0 inline-flex h-9 items-center rounded-lg border border-input bg-muted/50 px-2.5 text-sm text-muted-foreground">+212</span>
                    <Input
                      id="nc_phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      dir="ltr"
                      placeholder="6XXXXXXXX"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" className="flex-1" loading={creatingClient} onClick={handleCreateClient}>
                    {t('common.add')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewClient(false); setNewClientName(''); setNewClientPhone(''); }}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <Label className="text-sm mb-2 block">{t('checkout.payment_method')}</Label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setMethod(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors',
                    method === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{t(opt.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {method === 'check' && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
            <p className="text-sm font-medium">{t('checkout.check_details')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="chk_num" className="text-xs">{t('checks.number')} *</Label>
                <Input id="chk_num" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} className="mt-1 font-mono" dir="ltr" />
              </div>
              <div>
                <Label htmlFor="chk_bank" className="text-xs">{t('checks.bank')} *</Label>
                <Input id="chk_bank" value={checkBank} onChange={(e) => setCheckBank(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="chk_issuer" className="text-xs">{t('checks.issuer')} *</Label>
                <Input id="chk_issuer" value={checkIssuer} onChange={(e) => setCheckIssuer(e.target.value)} className="mt-1" placeholder={clientName ?? ''} />
              </div>
              <div>
                <Label htmlFor="chk_due" className="text-xs">{t('checks.due_date')} *</Label>
                <Input id="chk_due" type="date" value={checkDueDate} onChange={(e) => setCheckDueDate(e.target.value)} className="mt-1" dir="ltr" />
              </div>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="paid" className="text-sm">{t('checkout.amount_received')} *</Label>
          <Input
            id="paid" type="text" inputMode="decimal" value={paidInput}
            onChange={(e) => setPaidInput(e.target.value)} onFocus={(e) => e.target.select()}
            placeholder={total.toFixed(2)} className="mt-1.5 font-mono text-lg h-12"
          />
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setPaidInput(total.toFixed(2))} className="col-span-3 sm:col-span-1 text-xs">
              {t('checkout.exact_amount')}
            </Button>
            {[50, 100, 200, 500].map((v) => (
              <Button key={v} variant="outline" size="sm" onClick={() => setPaidInput(String(v))} className="text-xs">
                {v}
              </Button>
            ))}
          </div>
        </div>

        {paid > 0 && (
          <div className="rounded-lg bg-muted/30 p-3 text-sm">
            {change > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('checkout.change')}</span>
                <span className="font-mono font-semibold text-success">{formatCurrency(change)}</span>
              </div>
            )}
            {credit > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('checkout.credit')}</span>
                <span className="font-mono font-semibold text-warning">{formatCurrency(credit)}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} loading={loading} disabled={items.length === 0}>
            {t('checkout.validate_sale')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
