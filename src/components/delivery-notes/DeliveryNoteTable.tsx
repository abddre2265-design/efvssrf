import React from 'react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { Eye, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { DeliveryNote } from './types';

interface DeliveryNoteTableProps {
  deliveryNotes: DeliveryNote[];
  isLoading: boolean;
  onView: (deliveryNote: DeliveryNote) => void;
}

export const DeliveryNoteTable: React.FC<DeliveryNoteTableProps> = ({
  deliveryNotes,
  isLoading,
  onView,
}) => {
  const { t, language, isRTL } = useLanguage();

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const getClientName = (deliveryNote: DeliveryNote): string => {
    if (!deliveryNote.client) return '-';
    if (deliveryNote.client.client_type === 'business_local' || deliveryNote.client.client_type === 'foreign') {
      return deliveryNote.client.company_name || '-';
    }
    return `${deliveryNote.client.first_name || ''} ${deliveryNote.client.last_name || ''}`.trim() || '-';
  };

  const formatCurrency = (amount: number, currency: string = 'TND'): string => {
    return `${amount.toFixed(3)} ${currency}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <motion.div
          className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (deliveryNotes.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        {t('no_delivery_notes')}
      </div>
    );
  }

  return (
    <div className="rounded-md border glass">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('delivery_note_number')}</TableHead>
            <TableHead>{t('date')}</TableHead>
            <TableHead>{t('client')}</TableHead>
            <TableHead>{t('invoice_number_linked')}</TableHead>
            <TableHead className="text-right">{t('total_ttc')}</TableHead>
            <TableHead className="w-[50px]">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveryNotes.map((deliveryNote, index) => (
            <motion.tr
              key={deliveryNote.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group"
            >
              <TableCell className="font-medium">
                {deliveryNote.delivery_note_number}
              </TableCell>
              <TableCell>
                {format(new Date(deliveryNote.delivery_date), 'PP', { locale: getDateLocale() })}
              </TableCell>
              <TableCell>{getClientName(deliveryNote)}</TableCell>
              <TableCell className="font-mono text-sm text-primary">
                {deliveryNote.invoice?.invoice_number || '-'}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(deliveryNote.total_ttc, deliveryNote.currency)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                    <DropdownMenuItem onClick={() => onView(deliveryNote)}>
                      <Eye className="h-4 w-4 mr-2" />
                      {t('view')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default DeliveryNoteTable;
