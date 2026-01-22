import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VatRate {
  id: string;
  rate: number;
  is_default: boolean;
}

export interface WithholdingRate {
  id: string;
  rate: number;
  name: string | null;
  is_default: boolean;
}

export interface CustomTaxValue {
  id: string;
  tax_type_id: string;
  value: number;
  label: string | null;
}

export interface CustomTaxType {
  id: string;
  name: string;
  application_type: 'add' | 'deduct';
  application_order: 'before_stamp' | 'after_stamp';
  applies_to_payment: boolean;
  value_type: 'fixed' | 'percentage';
  values: CustomTaxValue[];
}

// Default rates (always available even without database records)
export const DEFAULT_VAT_RATES = [0, 7, 13, 19];
export const DEFAULT_WITHHOLDING_RATES = [0, 0.5, 1, 1.5, 2, 3, 5, 10, 15, 20, 25];

export const useTaxRates = (organizationId: string | null) => {
  const [vatRates, setVatRates] = useState<number[]>(DEFAULT_VAT_RATES);
  const [withholdingRates, setWithholdingRates] = useState<number[]>(DEFAULT_WITHHOLDING_RATES);
  const [customTaxTypes, setCustomTaxTypes] = useState<CustomTaxType[]>([]);
  const [stampDutyAmount, setStampDutyAmount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTaxRates = useCallback(async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      // Fetch VAT rates
      const { data: vatData } = await supabase
        .from('vat_rates')
        .select('rate')
        .eq('organization_id', organizationId);

      // Combine default and custom VAT rates
      const customVatRates = vatData?.map(v => v.rate) || [];
      const allVatRates = [...new Set([...DEFAULT_VAT_RATES, ...customVatRates])].sort((a, b) => a - b);
      setVatRates(allVatRates);

      // Fetch withholding rates
      const { data: whData } = await supabase
        .from('withholding_rates')
        .select('rate')
        .eq('organization_id', organizationId);

      // Combine default and custom withholding rates
      const customWhRates = whData?.map(w => w.rate) || [];
      const allWhRates = [...new Set([...DEFAULT_WITHHOLDING_RATES, ...customWhRates])].sort((a, b) => a - b);
      setWithholdingRates(allWhRates);

      // Fetch stamp duty
      const { data: stampData } = await supabase
        .from('stamp_duty_settings')
        .select('amount')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (stampData) {
        setStampDutyAmount(stampData.amount);
      }

      // Fetch custom tax types with values
      const { data: taxTypesData } = await supabase
        .from('custom_tax_types')
        .select(`
          id,
          name,
          application_type,
          application_order,
          applies_to_payment,
          value_type,
          custom_tax_values (
            id,
            tax_type_id,
            value,
            label
          )
        `)
        .eq('organization_id', organizationId);

      if (taxTypesData) {
        const mappedTypes: CustomTaxType[] = taxTypesData.map(tt => ({
          id: tt.id,
          name: tt.name,
          application_type: tt.application_type as 'add' | 'deduct',
          application_order: tt.application_order as 'before_stamp' | 'after_stamp',
          applies_to_payment: tt.applies_to_payment,
          value_type: tt.value_type as 'fixed' | 'percentage',
          values: tt.custom_tax_values || [],
        }));
        setCustomTaxTypes(mappedTypes);
      }
    } catch (error) {
      console.error('Error fetching tax rates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchTaxRates();
  }, [fetchTaxRates]);

  return {
    vatRates,
    withholdingRates,
    customTaxTypes,
    stampDutyAmount,
    isLoading,
    refresh: fetchTaxRates,
  };
};
