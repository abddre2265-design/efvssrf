import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceLineFormData, calculateLineTotal, formatCurrency } from './types';
import { CustomTaxType } from '@/hooks/useTaxRates';

export interface SelectedCustomTax {
  taxTypeId: string;
  taxValueId: string;
  taxName: string;
  value: number;
  valueType: 'fixed' | 'percentage';
  applicationType: 'add' | 'deduct';
  applicationOrder: 'before_stamp' | 'after_stamp';
}

interface InvoiceTotalsProps {
  lines: InvoiceLineFormData[];
  isForeign: boolean;
  currency: string;
  stampDutyEnabled: boolean;
  stampDutyAmount: number;
  onStampDutyEnabledChange: (enabled: boolean) => void;
  onStampDutyAmountChange: (amount: number) => void;
  // Custom taxes support
  customTaxTypes?: CustomTaxType[];
  selectedCustomTaxes?: SelectedCustomTax[];
  onCustomTaxesChange?: (taxes: SelectedCustomTax[]) => void;
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
  customTaxTypes = [],
  selectedCustomTaxes = [],
  onCustomTaxesChange,
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
  
  // Calculate custom tax amounts
  const calculateCustomTaxAmount = (tax: SelectedCustomTax, baseAmount: number): number => {
    if (tax.valueType === 'fixed') {
      return tax.value;
    }
    return baseAmount * (tax.value / 100);
  };

  // Separate taxes by application order
  const taxesBeforeStamp = selectedCustomTaxes.filter(t => t.applicationOrder === 'before_stamp');
  const taxesAfterStamp = selectedCustomTaxes.filter(t => t.applicationOrder === 'after_stamp');

  // Calculate running total with custom taxes
  let runningTotal = totalTtc;
  
  // Apply taxes before stamp
  taxesBeforeStamp.forEach(tax => {
    const amount = calculateCustomTaxAmount(tax, totalTtc);
    if (tax.applicationType === 'add') {
      runningTotal += amount;
    } else {
      runningTotal -= amount;
    }
  });

  // Apply stamp duty
  const stampDuty = isForeign ? 0 : stampDutyEnabled ? stampDutyAmount : 0;
  runningTotal += stampDuty;

  // Apply taxes after stamp
  taxesAfterStamp.forEach(tax => {
    const amount = calculateCustomTaxAmount(tax, totalTtc);
    if (tax.applicationType === 'add') {
      runningTotal += amount;
    } else {
      runningTotal -= amount;
    }
  });

  const netPayable = runningTotal;

  // Sort VAT breakdown by rate
  vatBreakdown.sort((a, b) => a.rate - b.rate);

  // Handler to add a custom tax
  const handleAddCustomTax = (taxTypeId: string, taxValueId: string) => {
    const taxType = customTaxTypes.find(t => t.id === taxTypeId);
    const taxValue = taxType?.values.find(v => v.id === taxValueId);
    
    if (!taxType || !taxValue || !onCustomTaxesChange) return;

    // Check if already added
    if (selectedCustomTaxes.some(t => t.taxValueId === taxValueId)) return;

    const newTax: SelectedCustomTax = {
      taxTypeId: taxType.id,
      taxValueId: taxValue.id,
      taxName: `${taxType.name}${taxValue.label ? ` - ${taxValue.label}` : ''}`,
      value: taxValue.value,
      valueType: taxType.value_type,
      applicationType: taxType.application_type,
      applicationOrder: taxType.application_order,
    };

    onCustomTaxesChange([...selectedCustomTaxes, newTax]);
  };

  // Handler to remove a custom tax
  const handleRemoveCustomTax = (taxValueId: string) => {
    if (!onCustomTaxesChange) return;
    onCustomTaxesChange(selectedCustomTaxes.filter(t => t.taxValueId !== taxValueId));
  };

  // Get available tax values (not already selected)
  const getAvailableTaxValues = () => {
    const selectedIds = new Set(selectedCustomTaxes.map(t => t.taxValueId));
    return customTaxTypes.flatMap(type => 
      type.values
        .filter(v => !selectedIds.has(v.id))
        .map(v => ({
          taxTypeId: type.id,
          taxValueId: v.id,
          label: `${type.name}${v.label ? ` - ${v.label}` : ''}: ${type.value_type === 'fixed' ? formatCurrency(v.value, 'TND') : `${v.value}%`}`,
          applicationType: type.application_type,
        }))
    );
  };

  const availableTaxValues = getAvailableTaxValues();

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

        {/* Custom taxes before stamp */}
        {taxesBeforeStamp.map((tax) => {
          const amount = calculateCustomTaxAmount(tax, totalTtc);
          const isDeduction = tax.applicationType === 'deduct';
          return (
            <div 
              key={tax.taxValueId} 
              className={`flex justify-between items-center text-sm ${isDeduction ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}
            >
              <div className="flex items-center gap-2">
                <span>{tax.taxName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => handleRemoveCustomTax(tax.taxValueId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <span>{isDeduction ? '-' : '+'}{formatCurrency(amount, 'TND')}</span>
            </div>
          );
        })}

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

        {/* Custom taxes after stamp */}
        {taxesAfterStamp.map((tax) => {
          const amount = calculateCustomTaxAmount(tax, totalTtc);
          const isDeduction = tax.applicationType === 'deduct';
          return (
            <div 
              key={tax.taxValueId} 
              className={`flex justify-between items-center text-sm ${isDeduction ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}
            >
              <div className="flex items-center gap-2">
                <span>{tax.taxName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => handleRemoveCustomTax(tax.taxValueId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <span>{isDeduction ? '-' : '+'}{formatCurrency(amount, 'TND')}</span>
            </div>
          );
        })}

        {/* Add custom tax selector */}
        {customTaxTypes.length > 0 && availableTaxValues.length > 0 && onCustomTaxesChange && (
          <div className="pt-2">
            <Select
              value=""
              onValueChange={(value) => {
                const [taxTypeId, taxValueId] = value.split('|');
                handleAddCustomTax(taxTypeId, taxValueId);
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <div className="flex items-center gap-2">
                  <Plus className="h-3 w-3" />
                  <SelectValue placeholder={t('add_custom_tax')} />
                </div>
              </SelectTrigger>
              <SelectContent>
                {availableTaxValues.map((tv) => (
                  <SelectItem 
                    key={tv.taxValueId} 
                    value={`${tv.taxTypeId}|${tv.taxValueId}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${tv.applicationType === 'add' ? 'text-blue-600' : 'text-amber-600'}`}
                      >
                        {tv.applicationType === 'add' ? '+' : '-'}
                      </Badge>
                      {tv.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Selected taxes badges */}
        {selectedCustomTaxes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {selectedCustomTaxes.map((tax) => (
              <Badge 
                key={tax.taxValueId} 
                variant="secondary" 
                className="text-xs gap-1"
              >
                {tax.taxName}
                <button
                  onClick={() => handleRemoveCustomTax(tax.taxValueId)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

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
