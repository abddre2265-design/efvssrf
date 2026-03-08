import { useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency as formatCurrencyBase } from '@/components/invoices/types';

/**
 * Language-aware currency formatting hook.
 * Returns a formatCurrency function pre-bound to the current language.
 */
export const useFormatCurrency = () => {
  const { language } = useLanguage();
  
  const formatCurrency = useCallback(
    (amount: number, currency: string = 'TND') => formatCurrencyBase(amount, currency, language),
    [language]
  );

  return formatCurrency;
};
