import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, Minus, AlertCircle, Infinity, Lock, Package } from 'lucide-react';
import { InvoiceLineFormData, VAT_RATES, calculateLineTotal } from './types';

interface InvoiceLineRowProps {
  line: InvoiceLineFormData;
  index: number;
  isForeign: boolean;
  maxQuantity: number | null;
  onUpdate: (index: number, updates: Partial<InvoiceLineFormData>) => void;
  onRemove: (index: number) => void;
  disableDelete?: boolean; // For reservation lines
  disableQuantityEdit?: boolean; // For reservation lines
}

export const InvoiceLineRow: React.FC<InvoiceLineRowProps> = ({
  line,
  index,
  isForeign,
  maxQuantity,
  onUpdate,
  onRemove,
  disableDelete = false,
  disableQuantityEdit = false,
}) => {
  const { t, isRTL } = useLanguage();

  const { lineHt, lineVat, lineTtc } = calculateLineTotal(
    line.quantity,
    line.unit_price_ht,
    line.vat_rate,
    line.discount_percent,
    isForeign
  );

  const canIncreaseQuantity = () => {
    if (maxQuantity === null) return true;
    return line.quantity < maxQuantity;
  };

  const clampQty = (qty: number) => {
    const minClamped = Math.max(1, qty);
    if (maxQuantity === null) return minClamped;
    return Math.min(minClamped, maxQuantity);
  };

  const handleQuantityChange = (delta: number) => {
    const next = clampQty(line.quantity + delta);
    if (delta > 0 && next === line.quantity) return;
    onUpdate(index, { quantity: next });
  };

  const handleDiscountChange = (value: string) => {
    const discount = parseFloat(value) || 0;
    const maxDiscount = line.max_discount || 100;
    const clampedDiscount = Math.min(Math.max(0, discount), maxDiscount);
    onUpdate(index, { discount_percent: clampedDiscount });
  };

  const stockWarning =
    !line.unlimited_stock &&
    !line.allow_out_of_stock_sale &&
    maxQuantity !== null &&
    line.quantity >= maxQuantity;

  const isReservationLine = line.fromReservation === true;

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${isReservationLine ? 'bg-primary/5 border-primary/30' : 'bg-card'}`}>
      {/* Reservation badge */}
      {isReservationLine && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <Package className="h-3 w-3 mr-1" />
            {t('from_reservation')}
          </Badge>
        </div>
      )}
      
      {/* Description field */}
      <Textarea
        value={line.description}
        onChange={(e) => onUpdate(index, { description: e.target.value })}
        placeholder={t('line_description_placeholder')}
        className="min-h-[60px] text-sm"
      />

      {/* Main line content */}
      <div className="grid grid-cols-12 gap-3 items-center">
        {/* Reference */}
        <div className="col-span-2">
          <div className="text-xs text-muted-foreground">{t('reference')}</div>
          <div className="font-mono text-sm">{line.product_reference || '-'}</div>
        </div>

        {/* Product name */}
        <div className="col-span-3">
          <div className="text-xs text-muted-foreground">{t('product')}</div>
          <div className="font-medium text-sm truncate">{line.product_name}</div>
        </div>

        {/* Quantity */}
        <div className="col-span-2">
          <div className="text-xs text-muted-foreground">{t('quantity')}</div>
          {disableQuantityEdit ? (
            <div className="flex items-center gap-2 h-8">
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{line.quantity}</span>
              <span className="text-xs text-muted-foreground">({t('reserved')})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleQuantityChange(-1)}
                disabled={line.quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={line.quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  onUpdate(index, { quantity: clampQty(val) });
                }}
                className="h-8 w-16 text-center"
                min={1}
                max={maxQuantity ?? undefined}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleQuantityChange(1)}
                disabled={!canIncreaseQuantity()}
              >
                <Plus className="h-3 w-3" />
              </Button>
              {/* Stock indicator */}
              {line.unlimited_stock ? (
                <Badge variant="outline" className="text-xs">
                  <Infinity className="h-3 w-3" />
                </Badge>
              ) : stockWarning ? (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              ) : null}
            </div>
          )}
        </div>

        {/* Unit Price HT */}
        <div className="col-span-1">
          <div className="text-xs text-muted-foreground">
            {isForeign ? t('unit_price') : t('unit_price_ht')}
          </div>
          <Input
            type="number"
            value={line.unit_price_ht}
            onChange={(e) => onUpdate(index, { unit_price_ht: parseFloat(e.target.value) || 0 })}
            className="h-8"
            step="0.001"
          />
        </div>

        {/* VAT Rate (hidden for foreign) */}
        {!isForeign && (
          <div className="col-span-1">
            <div className="text-xs text-muted-foreground">{t('vat')}</div>
            <Select
              value={String(line.vat_rate)}
              onValueChange={(val) => onUpdate(index, { vat_rate: parseInt(val) })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_RATES.map((rate) => (
                  <SelectItem key={rate} value={String(rate)}>
                    {rate}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Discount */}
        <div className={isForeign ? 'col-span-1' : 'col-span-1'}>
          <div className="text-xs text-muted-foreground">{t('discount')}</div>
          <div className="relative">
            <Input
              type="number"
              value={line.discount_percent}
              onChange={(e) => handleDiscountChange(e.target.value)}
              className="h-8 pr-6"
              min={0}
              max={line.max_discount || 100}
              step="0.01"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
        </div>

        {/* Line Total */}
        <div className={isForeign ? 'col-span-2' : 'col-span-1'}>
          <div className="text-xs text-muted-foreground">
            {isForeign ? t('total') : t('total_ttc')}
          </div>
          <div className="font-semibold text-primary">
            {(isForeign ? lineHt : lineTtc).toFixed(3)}
          </div>
        </div>

        {/* Delete button */}
        <div className="col-span-1 flex justify-end">
          {disableDelete ? (
            <div className="h-8 w-8 flex items-center justify-center text-muted-foreground" title={t('cannot_delete_reservation_line')}>
              <Lock className="h-4 w-4" />
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
