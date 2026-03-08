import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const PO_PREFIXES: Record<string, string> = {
  fr: 'BC',
  en: 'PO',
  ar: 'ط.ش',
};

export const generatePONumber = (prefix: string, year: number, counter: number): string => {
  return `${prefix}-${year}-${String(counter).padStart(5, '0')}`;
};

interface PurchaseOrderNumberInputProps {
  orderDate: string;
  organizationId: string | null;
  value: { prefix: string; year: number; counter: number };
  onChange: (value: { prefix: string; year: number; counter: number; number: string }) => void;
  onValidityChange: (isValid: boolean) => void;
}

export const PurchaseOrderNumberInput: React.FC<PurchaseOrderNumberInputProps> = ({
  orderDate,
  organizationId,
  value,
  onChange,
  onValidityChange,
}) => {
  const { t, language } = useLanguage();
  const [isManual, setIsManual] = useState(false);
  const [manualCounter, setManualCounter] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<number[]>([]);
  const [nextAutoCounter, setNextAutoCounter] = useState(1);

  const currentYear = orderDate ? new Date(orderDate).getFullYear() : new Date().getFullYear();
  const currentPrefix = PO_PREFIXES[language] || PO_PREFIXES.fr;

  const fetchNextCounter = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select('order_counter')
        .eq('organization_id', organizationId)
        .eq('order_year', currentYear)
        .order('order_counter', { ascending: false })
        .limit(1);

      if (error) throw error;

      const maxCounter = data?.[0]?.order_counter || 0;
      const next = maxCounter + 1;
      setNextAutoCounter(next);

      if (!isManual) {
        const newNumber = generatePONumber(currentPrefix, currentYear, next);
        onChange({ prefix: currentPrefix, year: currentYear, counter: next, number: newNumber });
        onValidityChange(true);
      }
    } catch (error) {
      console.error('Error fetching next counter:', error);
    }
  }, [organizationId, currentYear, currentPrefix, isManual]);

  const fetchSuggestions = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select('order_counter')
        .eq('organization_id', organizationId)
        .eq('order_year', currentYear)
        .order('order_counter', { ascending: true });

      if (error) throw error;

      const usedCounters = new Set(data?.map((d: any) => d.order_counter) || []);
      const maxCounter = Math.max(...Array.from(usedCounters as Set<number>), 0);

      const gaps: number[] = [];
      for (let i = 1; i < maxCounter && gaps.length < 10; i++) {
        if (!usedCounters.has(i)) {
          gaps.push(i);
        }
      }
      setSuggestions(gaps);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  }, [organizationId, currentYear]);

  const checkCounterAvailability = useCallback(async (counter: number) => {
    if (!organizationId || counter <= 0) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    try {
      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('order_year', currentYear)
        .eq('order_counter', counter)
        .maybeSingle();

      if (error) throw error;

      const available = !data;
      setIsAvailable(available);
      onValidityChange(available);

      if (available) {
        const newNumber = generatePONumber(currentPrefix, currentYear, counter);
        onChange({ prefix: currentPrefix, year: currentYear, counter, number: newNumber });
      }
    } catch (error) {
      console.error('Error checking counter:', error);
      setIsAvailable(null);
    } finally {
      setIsChecking(false);
    }
  }, [organizationId, currentYear, currentPrefix]);

  useEffect(() => {
    fetchNextCounter();
    if (isManual) {
      fetchSuggestions();
    }
  }, [organizationId, currentYear, currentPrefix, isManual]);

  const handleManualCounterChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 5);
    setManualCounter(cleaned);
    setIsAvailable(null);

    if (cleaned.length === 5) {
      const counter = parseInt(cleaned, 10);
      checkCounterAvailability(counter);
    } else {
      onValidityChange(false);
    }
  };

  const handleSelectSuggestion = (counter: number) => {
    const paddedCounter = String(counter).padStart(5, '0');
    setManualCounter(paddedCounter);
    checkCounterAvailability(counter);
  };

  const handleToggleManual = (enabled: boolean) => {
    setIsManual(enabled);
    setManualCounter('');
    setIsAvailable(null);

    if (!enabled) {
      const newNumber = generatePONumber(currentPrefix, currentYear, nextAutoCounter);
      onChange({ prefix: currentPrefix, year: currentYear, counter: nextAutoCounter, number: newNumber });
      onValidityChange(true);
    } else {
      onValidityChange(false);
      fetchSuggestions();
    }
  };

  const displayNumber = isManual
    ? generatePONumber(currentPrefix, currentYear, parseInt(manualCounter || '0', 10))
    : generatePONumber(currentPrefix, currentYear, nextAutoCounter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t('order_number') || 'N° Bon de commande'}</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('manual_numbering') || 'Numérotation manuelle'}</span>
          <Switch checked={isManual} onCheckedChange={handleToggleManual} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-20">
          <Input value={currentPrefix} disabled className="text-center font-mono" />
        </div>
        <span className="text-muted-foreground">-</span>
        <div className="w-20">
          <Input value={currentYear} disabled className="text-center font-mono" />
        </div>
        <span className="text-muted-foreground">-</span>
        <div className="flex-1 relative">
          {isManual ? (
            <div className="relative">
              <Input
                value={manualCounter}
                onChange={(e) => handleManualCounterChange(e.target.value)}
                placeholder="00001"
                className="font-mono pr-10"
                maxLength={5}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!isChecking && isAvailable === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {!isChecking && isAvailable === false && <XCircle className="h-4 w-4 text-destructive" />}
              </div>
            </div>
          ) : (
            <Input
              value={String(nextAutoCounter).padStart(5, '0')}
              disabled
              className="font-mono"
            />
          )}
        </div>
      </div>

      {isManual && manualCounter.length === 5 && (
        <div className={`text-sm ${isAvailable ? 'text-green-600' : 'text-destructive'}`}>
          {isAvailable ? (t('number_available') || 'Numéro disponible') : (t('number_not_available') || 'Numéro déjà utilisé')}
        </div>
      )}

      {isManual && suggestions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t('available_numbers') || 'Numéros disponibles'}</Label>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((counter) => (
              <Button
                key={counter}
                type="button"
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => handleSelectSuggestion(counter)}
              >
                {String(counter).padStart(5, '0')}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('full_order_number') || 'Numéro complet'}:</span>
        <Badge variant="outline" className="font-mono text-base">
          {displayNumber}
        </Badge>
      </div>
    </div>
  );
};
