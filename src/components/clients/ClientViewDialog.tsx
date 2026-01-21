import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Client } from './types';
import { format } from 'date-fns';
import { fr, arSA, enUS } from 'date-fns/locale';

interface ClientViewDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientViewDialog: React.FC<ClientViewDialogProps> = ({
  client,
  open,
  onOpenChange,
}) => {
  const { t, language, isRTL } = useLanguage();

  if (!client) return null;

  const getLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'fr': return fr;
      default: return enUS;
    }
  };

  const getClientName = (): string => {
    if (client.company_name) {
      return client.company_name;
    }
    return `${client.first_name || ''} ${client.last_name || ''}`.trim();
  };

  const getClientTypeBadge = () => {
    const variants: Record<string, { label: string; className: string }> = {
      individual_local: {
        label: t('individual_local'),
        className: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
      },
      business_local: {
        label: t('business_local'),
        className: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
      },
      foreign: {
        label: t('foreign_client'),
        className: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
      },
    };
    
    const variant = variants[client.client_type] || variants.individual_local;
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const formatPhone = (prefix: string | null, phone: string | null): string => {
    if (!phone) return '-';
    return prefix ? `${prefix} ${phone}` : phone;
  };

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || '-'}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getClientName()}
            {getClientTypeBadge()}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Identity */}
            <div>
              <h3 className="font-semibold mb-3">{t('identity')}</h3>
              <div className="space-y-1 text-sm">
                {client.first_name && (
                  <InfoRow label={t('first_name')} value={client.first_name} />
                )}
                {client.last_name && (
                  <InfoRow label={t('last_name')} value={client.last_name} />
                )}
                {client.company_name && (
                  <InfoRow label={t('company_name')} value={client.company_name} />
                )}
                <InfoRow label={t('identifier_type')} value={t(`identifier_${client.identifier_type}`)} />
                <InfoRow label={t('identifier_value')} value={
                  <code className="bg-muted px-2 py-1 rounded">{client.identifier_value}</code>
                } />
              </div>
            </div>

            <Separator />

            {/* Address */}
            <div>
              <h3 className="font-semibold mb-3">{t('address')}</h3>
              <div className="space-y-1 text-sm">
                <InfoRow label={t('country')} value={client.country} />
                {client.governorate && (
                  <InfoRow label={t('governorate')} value={client.governorate} />
                )}
                {client.address && (
                  <InfoRow label={t('address_line')} value={client.address} />
                )}
                {client.postal_code && (
                  <InfoRow label={t('postal_code')} value={client.postal_code} />
                )}
              </div>
            </div>

            <Separator />

            {/* Contact */}
            <div>
              <h3 className="font-semibold mb-3">{t('contact')}</h3>
              <div className="space-y-1 text-sm">
                <InfoRow label={t('phone')} value={formatPhone(client.phone_prefix, client.phone)} />
                <InfoRow label="WhatsApp" value={formatPhone(client.whatsapp_prefix, client.whatsapp)} />
                <InfoRow label={t('email')} value={client.email} />
              </div>
            </div>

            <Separator />

            {/* Metadata */}
            <div>
              <h3 className="font-semibold mb-3">{t('information')}</h3>
              <div className="space-y-1 text-sm">
                <InfoRow label={t('status')} value={
                  <Badge variant="outline" className={
                    client.status === 'active' 
                      ? 'bg-green-500/10 text-green-500 border-green-500/30'
                      : 'bg-gray-500/10 text-gray-500 border-gray-500/30'
                  }>
                    {t(client.status)}
                  </Badge>
                } />
                <InfoRow 
                  label={t('created_at')} 
                  value={format(new Date(client.created_at), 'PPP', { locale: getLocale() })} 
                />
                <InfoRow 
                  label={t('updated_at')} 
                  value={format(new Date(client.updated_at), 'PPP', { locale: getLocale() })} 
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
