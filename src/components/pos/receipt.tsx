'use client';

import type { Sale } from '@/types/database';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

interface ReceiptProps {
  sale: Sale;
  width?: '58mm' | '80mm';
  /** 'client' = ticket client (sans QR, sans restant) ; 'magasin' = copie interne / bon de commande */
  variant?: 'client' | 'magasin';
}

export function Receipt({ sale, width = '80mm', variant = 'client' }: ReceiptProps) {
  const { t } = useI18n();
  const widthCss = width === '58mm' ? '58mm' : '80mm';
  const paymentLabel: Record<string, string> = {
    cash: t('receipt.cash'), card: t('receipt.cash'), check: t('receipt.check'), transfer: t('receipt.transfer'), mixed: t('receipt.transfer'),
  };
  const isMagasin = variant === 'magasin';

  return (
    <div
      className="receipt mx-auto bg-white text-black" dir="ltr"
      style={{ width: widthCss, padding: '6mm 4mm', fontFamily: 'Courier New, monospace' }}
    >
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
          {sale.store?.name ?? 'TextilePOS'}
        </div>
        {sale.store?.address && <div style={{ fontSize: 9, marginTop: 2 }}>{sale.store.address}</div>}
        {sale.store?.phone && <div style={{ fontSize: 9 }}>Tél : {sale.store.phone}</div>}

        {/* Bandeau distinctif pour le ticket magasin */}
        {isMagasin && (
          <div style={{
            marginTop: 6, padding: '3px 0', border: '1.5px solid #000',
            fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
          }}>
            {t('receipt.order_copy')}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', fontSize: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('receipt.number')} :</span><span style={{ fontWeight: 'bold' }}>{sale.sale_number}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('receipt.date')} :</span><span>{formatDateTime(sale.sale_date)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('receipt.cashier')} :</span><span>{sale.cashier?.full_name ?? '—'}</span>
        </div>
        {sale.client && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('receipt.client')} :</span><span>{sale.client.name}</span>
          </div>
        )}
      </div>

      {/* Articles */}
      <div style={{ fontSize: 10 }}>
        {(sale.items ?? []).map((it, idx) => (
          <div key={it.id || idx} style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 'bold', fontSize: 11 }}>
              {it.product?.name ?? it.roll?.product?.name ?? '—'}
            </div>
            {it.product?.category && (
              <div style={{ fontSize: 9, opacity: 0.7 }}>{it.product.category.name}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{formatNumber(it.meters_sold, 2)} m × {formatCurrency(it.price_per_meter)}/m</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(it.line_total)}</span>
            </div>
            {it.discount_percent > 0 && (
              <div style={{ fontSize: 9, fontStyle: 'italic' }}>Remise −{it.discount_percent}%</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dashed #000', paddingTop: 4, marginTop: 6, fontSize: 10 }}>
        <Row label={t('receipt.subtotal')} value={formatCurrency(sale.subtotal)} />
        {sale.discount_amount > 0 && <Row label={t('receipt.discount')} value={`−${formatCurrency(sale.discount_amount)}`} />}
        {sale.tax_amount > 0 && <Row label={t('receipt.tax')} value={formatCurrency(sale.tax_amount)} />}
        <div style={{ borderTop: '1px solid #000', marginTop: 4, paddingTop: 4 }}>
          <Row label={<strong>{t('receipt.total')}</strong>} value={<strong style={{ fontSize: 13 }}>{formatCurrency(sale.total)}</strong>} />
        </div>
        <div style={{ marginTop: 4 }}>
          <Row label={paymentLabel[sale.payment_method] ?? sale.payment_method} value={formatCurrency(sale.paid_amount)} />
          {sale.change_amount > 0 && <Row label={t('receipt.change')} value={formatCurrency(sale.change_amount)} />}
          {sale.credit_amount > 0 && <Row label={t('receipt.credit')} value={formatCurrency(sale.credit_amount)} />}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, fontStyle: 'italic' }}>
        {isMagasin ? t('receipt.keep') : t('receipt.thanks')}
      </div>
      <div style={{ textAlign: 'center', marginTop: 4, fontSize: 8, opacity: 0.6 }}>
        TextilePOS
      </div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'Courier New, monospace' }}>{value}</span>
    </div>
  );
}
