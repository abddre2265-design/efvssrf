import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClientForm } from './ClientForm';
import { ClientFormData, Client } from './types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientEditDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const ClientEditDialog: React.FC<ClientEditDialogProps> = ({
  client,
  open,
  onOpenChange,
  onUpdated,
}) => {
  const { t, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  if (!client) return null;

  const initialData: ClientFormData = {
    clientType: client.client_type,
    firstName: client.first_name || '',
    lastName: client.last_name || '',
    companyName: client.company_name || '',
    identifierType: client.identifier_type,
    identifierValue: client.identifier_value,
    country: client.country,
    governorate: client.governorate || '',
    address: client.address || '',
    postalCode: client.postal_code || '',
    phonePrefix: client.phone_prefix || '+216',
    phone: client.phone || '',
    whatsappPrefix: client.whatsapp_prefix || '+216',
    whatsapp: client.whatsapp || '',
    email: client.email || '',
  };

  const handleSubmit = async (data: ClientFormData) => {
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
        .from('clients')
        .update(updateData)
        .eq('id', client.id);

      if (error) throw error;

      toast.success(t('client_updated'));
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error(t('error_updating_client'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{t('edit_client')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
          <ClientForm
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
