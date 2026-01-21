import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { InvoiceLineFormData, calculateLineTotal, formatCurrency } from './types';

interface InvoiceTotalsProps {
  lines: InvoiceLineFormData[];
  isForeign: boolean;
  currency: string;
  stampDutyEnabled: boolean;
  stampDutyAmount: number;
  onStampDutyEnabledChange: (enabled: boolean) => void;
  onStampDutyAmountChange: (amount: number) => void;
}

interface VatBreakdown {
  rate: number;
  base: number;
  amount: number;
}

export const InvoiceTotals: React.FC<InvoiceTotalsProps> = ({
  lines,
  isForeign,
  currency,
  stampDutyEnabled,
  stampDutyAmount,
  onStampDutyEnabledChange,
  onStampDutyAmountChange,
}) => {
  const { t, isRTL } = useLanguage();

  // Calculate all totals
  const calculations = lines.reduce(
    (acc, line) => {
      const { lineHt, lineVat, lineTtc } = calculateLineTotal(
        line.quantity,
        line.unit_price_ht,
        line.vat_rate,
        line.discount_percent,
        isForeign
      );

      // Calculate discount amount
      const grossHt = line.quantity * line.unit_price_ht;
      const discountAmount = grossHt - (grossHt * (1 - line.discount_percent / 100));

      acc.subtotalHt += lineHt;
      acc.totalVat += lineVat;
      acc.totalDiscount += discountAmount;
      acc.totalTtc += lineTtc;

      // VAT breakdown
      if (!isForeign && line.vat_rate > 0) {
        const existing = acc.vatBreakdown.find((v) => v.rate === line.vat_rate);
        if (existing) {
          existing.base += lineHt;
          existing.amount += lineVat;
        } else {
          acc.vatBreakdown.push({ rate: line.vat_rate, base: lineHt, amount: lineVat });
        }
      }

      return acc;
    },
    {
      subtotalHt: 0,
      totalVat: 0,
      totalDiscount: 0,
      totalTtc: 0,
      vatBreakdown: [] as VatBreakdown[],
    }
  );

  const { subtotalHt, totalVat, totalDiscount, totalTtc, vatBreakdown } = calculations;
  const stampDuty = isForeign ? 0 : stampDutyEnabled ? stampDutyAmount : 0;
  const netPayable = totalTtc + stampDuty;

  // Sort VAT breakdown by rate
  vatBreakdown.sort((a, b) => a.rate - b.rate);

  if (isForeign) {
    // Foreign client - simplified totals
    return (
      <div className="border rounded-lg p-4 space-y-3 bg-card" dir={isRTL ? 'rtl' : 'ltr'}>
        <h3 className="font-semibold">{t('totals')}</h3>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('subtotal')}</span>
            <span className="font-medium">{formatCurrency(subtotalHt, currency)}</span>
          </div>

          {totalDiscount > 0 && (
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>{t('total_discount')}</span>
              <span>-{formatCurrency(totalDiscount, currency)}</span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between text-lg font-bold">
            <span>{t('net_payable')}</span>
            <span className="text-primary">{formatCurrency(subtotalHt, currency)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Local client - full totals with VAT
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card" dir={isRTL ? 'rtl' : 'ltr'}>
      <h3 className="font-semibold">{t('totals')}</h3>

      <div className="space-y-2">
        {/* Subtotal HT */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('subtotal_ht')}</span>
          <span className="font-medium">{formatCurrency(subtotalHt, 'TND')}</span>
        </div>

        {/* VAT breakdown */}
        {vatBreakdown.map((vat) => (
          <div key={vat.rate} className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t('vat')} {vat.rate}% ({formatCurrency(vat.base, 'TND')})
            </span>
            <span>{formatCurrency(vat.amount, 'TND')}</span>
          </div>
        ))}

        {/* Total VAT (only if multiple rates) */}
        {vatBreakdown.length > 1 && (
          <div className="flex justify-between font-medium">
            <span>{t('total_vat')}</span>
            <span>{formatCurrency(totalVat, 'TND')}</span>
          </div>
        )}

        {/* Total Discount */}
        {totalDiscount > 0 && (
          <div className="flex justify-between text-green-600 dark:text-green-400">
            <span>{t('total_discount')}</span>
            <span>-{formatCurrency(totalDiscount, 'TND')}</span>
          </div>
        )}

        <Separator />

        {/* Total TTC */}
        <div className="flex justify-between font-semibold">
          <span>{t('total_ttc')}</span>
          <span>{formatCurrency(totalTtc, 'TND')}</span>
        </div>

        {/* Stamp duty */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <Switch
              id="stamp-duty"
              checked={stampDutyEnabled}
              onCheckedChange={onStampDutyEnabledChange}
            />
            <Label htmlFor="stamp-duty">{t('stamp_duty')}</Label>
          </div>
          {stampDutyEnabled && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={stampDutyAmount}
                onChange={(e) => onStampDutyAmountChange(parseFloat(e.target.value) || 0)}
                className="w-24 h-8"
                step="0.001"
              />
              <span className="text-sm text-muted-foreground">DT</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Net Payable */}
        <div className="flex justify-between text-lg font-bold">
          <span>{t('net_payable')}</span>
          <span className="text-primary">{formatCurrency(netPayable, 'TND')}</span>
        </div>
      </div>
    </div>
  );
};
