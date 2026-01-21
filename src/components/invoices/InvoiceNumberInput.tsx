import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { INVOICE_PREFIXES, generateInvoiceNumber } from './types';
import { Language } from '@/contexts/LanguageContext';

interface InvoiceNumberInputProps {
  invoiceDate: Date | null;
  organizationId: string | null;
  value: { prefix: string; year: number; counter: number };
  onChange: (value: { prefix: string; year: number; counter: number; number: string }) => void;
  onValidityChange: (isValid: boolean) => void;
}

export const InvoiceNumberInput: React.FC<InvoiceNumberInputProps> = ({
  invoiceDate,
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

  const currentYear = invoiceDate ? invoiceDate.getFullYear() : new Date().getFullYear();
  const currentPrefix = INVOICE_PREFIXES[language as keyof typeof INVOICE_PREFIXES] || INVOICE_PREFIXES.fr;

  // Fetch next available counter
  const fetchNextCounter = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_counter')
        .eq('organization_id', organizationId)
        .eq('invoice_year', currentYear)
        .order('invoice_counter', { ascending: false })
        .limit(1);

      if (error) throw error;

      const maxCounter = data?.[0]?.invoice_counter || 0;
      const next = maxCounter + 1;
      setNextAutoCounter(next);

      if (!isManual) {
        const newNumber = generateInvoiceNumber(currentPrefix, currentYear, next);
        onChange({ prefix: currentPrefix, year: currentYear, counter: next, number: newNumber });
        onValidityChange(true);
      }
    } catch (error) {
      console.error('Error fetching next counter:', error);
    }
  }, [organizationId, currentYear, currentPrefix, isManual, onChange, onValidityChange]);

  // Fetch available suggestions (gaps in numbering)
  const fetchSuggestions = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_counter')
        .eq('organization_id', organizationId)
        .eq('invoice_year', currentYear)
        .order('invoice_counter', { ascending: true });

      if (error) throw error;

      const usedCounters = new Set(data?.map(d => d.invoice_counter) || []);
      const maxCounter = Math.max(...Array.from(usedCounters), 0);
      
      // Find gaps
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

  // Check if manual counter is available
  const checkCounterAvailability = useCallback(async (counter: number) => {
    if (!organizationId || counter <= 0) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('invoice_year', currentYear)
        .eq('invoice_counter', counter)
        .maybeSingle();

      if (error) throw error;

      const available = !data;
      setIsAvailable(available);
      onValidityChange(available);

      if (available) {
        const newNumber = generateInvoiceNumber(currentPrefix, currentYear, counter);
        onChange({ prefix: currentPrefix, year: currentYear, counter, number: newNumber });
      }
    } catch (error) {
      console.error('Error checking counter:', error);
      setIsAvailable(null);
    } finally {
      setIsChecking(false);
    }
  }, [organizationId, currentYear, currentPrefix, onChange, onValidityChange]);

  // Update when date or language changes
  useEffect(() => {
    fetchNextCounter();
    if (isManual) {
      fetchSuggestions();
    }
  }, [fetchNextCounter, fetchSuggestions, isManual, invoiceDate, language]);

  // Handle manual counter input
  const handleManualCounterChange = (val: string) => {
    // Only allow digits
    const cleaned = val.replace(/\D/g, '').slice(0, 5);
    setManualCounter(cleaned);
    setIsAvailable(null);

    // Check availability when 5 digits entered
    if (cleaned.length === 5) {
      const counter = parseInt(cleaned, 10);
      checkCounterAvailability(counter);
    } else {
      onValidityChange(false);
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (counter: number) => {
    const paddedCounter = String(counter).padStart(5, '0');
    setManualCounter(paddedCounter);
    checkCounterAvailability(counter);
  };

  // Toggle manual mode
  const handleToggleManual = (enabled: boolean) => {
    setIsManual(enabled);
    setManualCounter('');
    setIsAvailable(null);

    if (!enabled) {
      // Switch back to auto mode
      const newNumber = generateInvoiceNumber(currentPrefix, currentYear, nextAutoCounter);
      onChange({ prefix: currentPrefix, year: currentYear, counter: nextAutoCounter, number: newNumber });
      onValidityChange(true);
    } else {
      onValidityChange(false);
      fetchSuggestions();
    }
  };

  const displayNumber = isManual
    ? generateInvoiceNumber(currentPrefix, currentYear, parseInt(manualCounter || '0', 10))
    : generateInvoiceNumber(currentPrefix, currentYear, nextAutoCounter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t('invoice_number')}</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('manual_numbering')}</span>
          <Switch checked={isManual} onCheckedChange={handleToggleManual} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Prefix */}
        <div className="w-20">
          <Input value={currentPrefix} disabled className="text-center font-mono" />
        </div>
        <span className="text-muted-foreground">-</span>
        {/* Year */}
        <div className="w-20">
          <Input value={currentYear} disabled className="text-center font-mono" />
        </div>
        <span className="text-muted-foreground">-</span>
        {/* Counter */}
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
                {!isChecking && isAvailable === false && <XCircle className="h-4 w-4 text-red-500" />}
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

      {/* Validation message */}
      {isManual && manualCounter.length === 5 && (
        <div className={`text-sm ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
          {isAvailable ? t('number_available') : t('number_not_available')}
        </div>
      )}

      {/* Suggestions */}
      {isManual && suggestions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t('available_numbers')}</Label>
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

      {/* Full number preview */}
      <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('full_invoice_number')}:</span>
        <Badge variant="outline" className="font-mono text-base">
          {displayNumber}
        </Badge>
      </div>
    </div>
  );
};
