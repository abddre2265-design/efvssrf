import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SupplierForm } from './SupplierForm';
import { SupplierFormData, Supplier } from './types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SupplierCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  duplicateFrom?: Supplier | null;
}

export const SupplierCreateDialog: React.FC<SupplierCreateDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
  duplicateFrom,
}) => {
  const { t, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('organizations')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          setOrganizationId(data.id);
        }
      }
    };
    fetchOrganization();
  }, []);

  const initialData: Partial<SupplierFormData> | undefined = duplicateFrom ? {
    supplierType: duplicateFrom.supplier_type,
    firstName: duplicateFrom.first_name || '',
    lastName: duplicateFrom.last_name || '',
    companyName: duplicateFrom.company_name || '',
    identifierType: duplicateFrom.identifier_type || '',
    identifierValue: '', // Always empty for duplicates
    country: duplicateFrom.country,
    governorate: duplicateFrom.governorate || '',
    address: duplicateFrom.address || '',
    postalCode: duplicateFrom.postal_code || '',
    phonePrefix: duplicateFrom.phone_prefix || '+216',
    phone: duplicateFrom.phone || '',
    whatsappPrefix: duplicateFrom.whatsapp_prefix || '+216',
    whatsapp: duplicateFrom.whatsapp || '',
    email: duplicateFrom.email || '',
  } : undefined;

  const handleSubmit = async (data: SupplierFormData) => {
    if (!organizationId) {
      toast.error(t('organization_not_found'));
      return;
    }

    setIsLoading(true);
    try {
      // Check if identifier already exists (only if identifier is provided)
      if (data.identifierValue) {
        const { data: existing } = await supabase
          .from('suppliers')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('identifier_value', data.identifierValue)
          .maybeSingle();

        if (existing) {
          toast.error(t('identifier_already_exists'));
          setIsLoading(false);
          return;
        }
      }

      const supplierData = {
        organization_id: organizationId,
        supplier_type: data.supplierType as 'individual_local' | 'business_local' | 'foreign',
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        company_name: data.companyName || null,
        identifier_type: data.identifierType || null,
        identifier_value: data.identifierValue || null,
        country: data.country,
        governorate: data.governorate || null,
        address: data.address || null,
        postal_code: data.postalCode || null,
        phone_prefix: data.phonePrefix || null,
        phone: data.phone || null,
        whatsapp_prefix: data.whatsappPrefix || null,
        whatsapp: data.whatsapp || null,
        email: data.email || null,
        status: 'active' as const,
      };

      const { error } = await supabase.from('suppliers').insert(supplierData);

      if (error) throw error;

      toast.success(t('supplier_created'));
      onCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      if (error.code === '23505') {
        toast.error(t('identifier_already_exists'));
      } else {
        toast.error(t('error_creating_supplier'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {duplicateFrom ? t('duplicate_supplier') : t('create_supplier')}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
          <SupplierForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={isLoading}
            isDuplicate={!!duplicateFrom}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
