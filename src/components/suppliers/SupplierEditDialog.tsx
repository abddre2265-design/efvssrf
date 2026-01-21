import React, { useState } from 'react';
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

interface SupplierEditDialogProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const SupplierEditDialog: React.FC<SupplierEditDialogProps> = ({
  supplier,
  open,
  onOpenChange,
  onUpdated,
}) => {
  const { t, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  if (!supplier) return null;

  const initialData: SupplierFormData = {
    supplierType: supplier.supplier_type,
    firstName: supplier.first_name || '',
    lastName: supplier.last_name || '',
    companyName: supplier.company_name || '',
    identifierType: supplier.identifier_type || '',
    identifierValue: supplier.identifier_value || '',
    country: supplier.country,
    governorate: supplier.governorate || '',
    address: supplier.address || '',
    postalCode: supplier.postal_code || '',
    phonePrefix: supplier.phone_prefix || '+216',
    phone: supplier.phone || '',
    whatsappPrefix: supplier.whatsapp_prefix || '+216',
    whatsapp: supplier.whatsapp || '',
    email: supplier.email || '',
  };

  const handleSubmit = async (data: SupplierFormData) => {
    setIsLoading(true);
    try {
      // Only update allowed fields (not identifier)
      const updateData = {
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        company_name: data.companyName || null,
        country: data.country,
        governorate: data.governorate || null,
        address: data.address || null,
        postal_code: data.postalCode || null,
        phone_prefix: data.phonePrefix || null,
        phone: data.phone || null,
        whatsapp_prefix: data.whatsappPrefix || null,
        whatsapp: data.whatsapp || null,
        email: data.email || null,
      };

      const { error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', supplier.id);

      if (error) throw error;

      toast.success(t('supplier_updated'));
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast.error(t('error_updating_supplier'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{t('edit_supplier')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
          <SupplierForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={isLoading}
            isEdit={true}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
