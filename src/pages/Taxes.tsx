import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calculator } from 'lucide-react';
import {
  VatRate,
  WithholdingRate,
  StampDutySetting,
  CustomTaxType,
  CustomTaxValue,
  VatRatesBlock,
  WithholdingRatesBlock,
  StampDutyBlock,
  CustomTaxesBlock,
} from '@/components/taxes';

const Taxes: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [vatRates, setVatRates] = useState<VatRate[]>([]);
  const [withholdingRates, setWithholdingRates] = useState<WithholdingRate[]>([]);
  const [stampDuty, setStampDuty] = useState<StampDutySetting | null>(null);
  const [customTaxes, setCustomTaxes] = useState<CustomTaxType[]>([]);

  const fetchOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: org, error } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return org?.id || null;
    } catch (error) {
      console.error('Error fetching organization:', error);
      return null;
    }
  };

  const fetchVatRates = useCallback(async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('vat_rates')
        .select('*')
        .eq('organization_id', orgId)
        .order('rate', { ascending: true });

      if (error) throw error;
      setVatRates(data || []);
    } catch (error) {
      console.error('Error fetching VAT rates:', error);
    }
  }, []);

  const fetchWithholdingRates = useCallback(async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('withholding_rates')
        .select('*')
        .eq('organization_id', orgId)
        .order('rate', { ascending: true });

      if (error) throw error;
      setWithholdingRates(data || []);
    } catch (error) {
      console.error('Error fetching withholding rates:', error);
    }
  }, []);

  const fetchStampDuty = useCallback(async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('stamp_duty_settings')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (error) throw error;
      setStampDuty(data);
    } catch (error) {
      console.error('Error fetching stamp duty:', error);
    }
  }, []);

  const fetchCustomTaxes = useCallback(async (orgId: string) => {
    try {
      const { data: taxes, error: taxesError } = await supabase
        .from('custom_tax_types')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });

      if (taxesError) throw taxesError;

      if (taxes && taxes.length > 0) {
        const { data: values, error: valuesError } = await supabase
          .from('custom_tax_values')
          .select('*')
          .in('tax_type_id', taxes.map(t => t.id))
          .order('value', { ascending: true });

        if (valuesError) throw valuesError;

        const taxesWithValues = taxes.map(tax => ({
          ...tax,
          values: values?.filter(v => v.tax_type_id === tax.id) || [],
        }));

        setCustomTaxes(taxesWithValues as CustomTaxType[]);
      } else {
        setCustomTaxes([]);
      }
    } catch (error) {
      console.error('Error fetching custom taxes:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const orgId = await fetchOrganization();
    if (orgId) {
      setOrganizationId(orgId);
      await Promise.all([
        fetchVatRates(orgId),
        fetchWithholdingRates(orgId),
        fetchStampDuty(orgId),
        fetchCustomTaxes(orgId),
      ]);
    }
    setIsLoading(false);
  }, [fetchVatRates, fetchWithholdingRates, fetchStampDuty, fetchCustomTaxes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    if (organizationId) {
      fetchVatRates(organizationId);
      fetchWithholdingRates(organizationId);
      fetchStampDuty(organizationId);
      fetchCustomTaxes(organizationId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calculator className="h-12 w-12 mb-4" />
        <p>{t('no_organization')}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div>
        <h1 className="text-3xl font-bold">{t('taxes')}</h1>
        <p className="text-muted-foreground">{t('taxes_page_description')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VatRatesBlock
          vatRates={vatRates}
          organizationId={organizationId}
          onRefresh={handleRefresh}
        />

        <WithholdingRatesBlock
          withholdingRates={withholdingRates}
          organizationId={organizationId}
          onRefresh={handleRefresh}
        />

        <StampDutyBlock
          stampDuty={stampDuty}
          organizationId={organizationId}
          onRefresh={handleRefresh}
        />
      </div>

      <CustomTaxesBlock
        customTaxes={customTaxes}
        organizationId={organizationId}
        onRefresh={handleRefresh}
      />
    </motion.div>
  );
};

export default Taxes;
