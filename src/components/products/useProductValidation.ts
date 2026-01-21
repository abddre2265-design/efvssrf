import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ValidationState {
  isChecking: boolean;
  exists: boolean;
  checkedValue: string;
}

interface ProductValidation {
  name: ValidationState;
  reference: ValidationState;
  ean: ValidationState;
}

const initialValidationState: ValidationState = {
  isChecking: false,
  exists: false,
  checkedValue: '',
};

export const useProductValidation = (organizationId: string | null, isEdit: boolean = false) => {
  const [validation, setValidation] = useState<ProductValidation>({
    name: { ...initialValidationState },
    reference: { ...initialValidationState },
    ean: { ...initialValidationState },
  });

  const debounceTimers = useRef<{
    name: NodeJS.Timeout | null;
    reference: NodeJS.Timeout | null;
    ean: NodeJS.Timeout | null;
  }>({
    name: null,
    reference: null,
    ean: null,
  });

  const checkField = useCallback(async (
    field: 'name' | 'reference' | 'ean',
    value: string
  ) => {
    if (!organizationId || isEdit || !value.trim()) {
      setValidation(prev => ({
        ...prev,
        [field]: { isChecking: false, exists: false, checkedValue: value },
      }));
      return;
    }

    setValidation(prev => ({
      ...prev,
      [field]: { ...prev[field], isChecking: true, checkedValue: value },
    }));

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq(field, value.trim())
        .maybeSingle();

      if (error) throw error;

      setValidation(prev => ({
        ...prev,
        [field]: {
          isChecking: false,
          exists: !!data,
          checkedValue: value,
        },
      }));
    } catch (error) {
      console.error(`Validation error for ${field}:`, error);
      setValidation(prev => ({
        ...prev,
        [field]: { isChecking: false, exists: false, checkedValue: value },
      }));
    }
  }, [organizationId, isEdit]);

  const validateField = useCallback((
    field: 'name' | 'reference' | 'ean',
    value: string,
    debounceMs: number = 500
  ) => {
    // Clear existing timer
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]!);
    }

    // Set checking state immediately for UI feedback
    if (value.trim()) {
      setValidation(prev => ({
        ...prev,
        [field]: { ...prev[field], isChecking: true },
      }));
    }

    // Debounce the actual check
    debounceTimers.current[field] = setTimeout(() => {
      checkField(field, value);
    }, debounceMs);
  }, [checkField]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const hasErrors = validation.name.exists || validation.reference.exists || validation.ean.exists;
  const isValidating = validation.name.isChecking || validation.reference.isChecking || validation.ean.isChecking;

  return {
    validation,
    validateField,
    hasErrors,
    isValidating,
  };
};
