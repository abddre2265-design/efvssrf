import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { StoreForm } from './StoreForm';
import { Store, StoreFormData } from './types';
import { Loader2, Pencil } from 'lucide-react';

interface StoreEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: Store | null;
  onSuccess: () => void;
}

export const StoreEditDialog: React.FC<StoreEditDialogProps> = ({
  open,
  onOpenChange,
  store,
  onSuccess,
}) => {
  const { t, isRTL } = useLanguage();
  const { toast } = useToast();
  const [formData, setFormData] = useState<StoreFormData>({
    name: '',
    address: '',
    city: '',
    governorate: '',
    postal_code: '',
    country: 'Tunisie',
    phone: '',
    email: '',
    google_maps_link: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setFormData({
        name: store.name || '',
        address: store.address || '',
        city: store.city || '',
        governorate: store.governorate || '',
        postal_code: store.postal_code || '',
        country: store.country || 'Tunisie',
        phone: store.phone || '',
        email: store.email || '',
        google_maps_link: store.google_maps_link || '',
      });
    }
  }, [store]);

  const handleSubmit = async () => {
    if (!store) return;

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
      const { error } = await supabase
        .from('stores')
        .update({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          governorate: formData.governorate || null,
          postal_code: formData.postal_code.trim() || null,
          country: formData.country.trim() || 'Tunisie',
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          google_maps_link: formData.google_maps_link.trim() || null,
        })
        .eq('id', store.id);

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('storeUpdated'),
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating store:', error);
      toast({
        title: t('error'),
        description: error.message || t('genericError'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg ${isRTL ? 'rtl' : ''}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            {t('editStore')}
          </DialogTitle>
        </DialogHeader>

        <StoreForm formData={formData} setFormData={setFormData} />

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
