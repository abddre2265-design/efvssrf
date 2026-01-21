import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { StoreForm } from './StoreForm';
import { StoreFormData } from './types';
import { Loader2, Plus } from 'lucide-react';

interface StoreCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const initialFormData: StoreFormData = {
  name: '',
  address: '',
  city: '',
  governorate: '',
  postal_code: '',
  country: 'Tunisie',
  phone: '',
  email: '',
  google_maps_link: '',
};

export const StoreCreateDialog: React.FC<StoreCreateDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { t, isRTL } = useLanguage();
  const { toast } = useToast();
  const [formData, setFormData] = useState<StoreFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: t('error'),
        description: t('storeNameRequired'),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      // Get organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!org) throw new Error('No organization found');

      const { error } = await supabase.from('stores').insert({
        organization_id: org.id,
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        governorate: formData.governorate || null,
        postal_code: formData.postal_code.trim() || null,
        country: formData.country.trim() || 'Tunisie',
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        google_maps_link: formData.google_maps_link.trim() || null,
      });

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('storeCreated'),
      });

      setFormData(initialFormData);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating store:', error);
      toast({
        title: t('error'),
        description: error.message || t('genericError'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFormData(initialFormData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-w-lg ${isRTL ? 'rtl' : ''}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t('createStore')}
          </DialogTitle>
        </DialogHeader>

        <StoreForm formData={formData} setFormData={setFormData} />

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('saving')}
              </>
            ) : (
              t('create')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
