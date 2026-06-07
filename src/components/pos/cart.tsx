'use client';

import { useState, useEffect } from 'react';
import { Minus, Plus, X, UserCheck, UserPlus } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { usePOSStore } from '@/store/pos';
import { formatCurrency, formatMeters, cn } from '@/lib/utils';
import type { Profile, CartItem } from '@/types/database';
import { useI18n } from '@/lib/i18n/context';

interface POSCartProps {
  profile: Profile;
}

export function POSCart({ profile }: POSCartProps) {
  const { t } = useI18n();
  const items = usePOSStore((s) => s.items);
  const clientName = usePOSStore((s) => s.clientName);
  const updateItem = usePOSStore((s) => s.updateItem);
  const removeItem = usePOSStore((s) => s.removeItem);
  const subtotal = usePOSStore((s) => s.subtotal());
  const itemsDiscount = usePOSStore((s) => s.itemsDiscount());
  const totalMeters = usePOSStore((s) => s.totalMeters());

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{t('pos.cart')}</h2>
          <p className="text-xs text-muted-foreground">
            {items.length} {t('pos.articles')} · {formatMeters(totalMeters)}
          </p>
        </div>
        {clientName && (
          <div className="flex items-center gap-1.5 text-xs rounded-lg border border-border px-2.5 py-1.5 text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            <span className="max-w-[110px] truncate">{clientName}</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">{t('pos.cart_empty')}</h3>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              {t('pos.cart_empty_hint')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item) => (
              <CartItemRow
                key={item.product.id}
                item={item}
                onUpdate={(patch) => updateItem(item.product.id, patch)}
                onRemove={() => removeItem(item.product.id)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>

      {items.length > 0 && (
        <div className="p-4 border-t border-border bg-muted/10 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('pos.subtotal')}</span>
            <span className="font-mono tabular-nums">{formatCurrency(subtotal + itemsDiscount)}</span>
          </div>

          {itemsDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('pos.line_discounts')}</span>
              <span className="font-mono tabular-nums text-success">−{formatCurrency(itemsDiscount)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CartItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  onUpdate: (patch: Partial<CartItem>) => void;
  onRemove: () => void;
}) {
  const [metersInput, setMetersInput] = useState<string>(item.meters.toString());
  const { t } = useI18n();

  useEffect(() => {
    const currentNum = parseFloat(metersInput);
    if (isNaN(currentNum) || Math.abs(currentNum - item.meters) > 0.001) {
      setMetersInput(item.meters.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.meters]);

  const handleMetersChange = (val: string) => {
    setMetersInput(val);
    const num = parseFloat(val);
    if (!isNaN(num)) onUpdate({ meters: num });
    else if (val === '') onUpdate({ meters: 0 });
  };

  const handleMetersBlur = () => {
    const num = parseFloat(metersInput);
    if (isNaN(num) || num < 0) {
      setMetersInput('0');
      onUpdate({ meters: 0 });
    } else {
      const capped = Math.min(num, item.product.stock_meters);
      setMetersInput(capped.toString());
      onUpdate({ meters: capped });
    }
  };

  const overStock = item.meters > item.product.stock_meters;

  return (
    <li className="p-3">
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-1 h-12 rounded-full shrink-0"
          style={{ backgroundColor: item.product.category?.color ?? 'hsl(var(--muted))' }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium leading-tight truncate">{item.product.name}</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {item.product.category?.name} · {formatMeters(item.product.stock_meters)} {t('pos.dispo')}
          </p>
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive p-1 -m-1" aria-label="Retirer">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="outline" onClick={() => onUpdate({ meters: Math.max(0.5, item.meters - 0.5) })} className="h-9 w-9">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <div className="flex-1 relative">
            <Input
              type="text"
              inputMode="decimal"
              value={metersInput}
              onChange={(e) => handleMetersChange(e.target.value)}
              onBlur={handleMetersBlur}
              onFocus={(e) => e.target.select()}
              className={cn('h-9 text-center font-mono text-sm pr-6', overStock && 'border-destructive text-destructive')}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">m</span>
          </div>
          <Button size="icon-sm" variant="outline" onClick={() => onUpdate({ meters: Math.min(item.product.stock_meters, item.meters + 0.5) })} className="h-9 w-9">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="text-right">
          <div className="font-mono font-semibold tabular-nums text-sm">
            {formatCurrency(item.meters * item.price_per_meter * (1 - item.discount_percent / 100))}
          </div>
          <div className="text-[10px] text-muted-foreground">{formatCurrency(item.price_per_meter)}/m</div>
        </div>
      </div>

      {overStock && (
        <p className="text-[11px] text-destructive mt-1">⚠ {t('pos.over_stock')}</p>
      )}
    </li>
  );
}

