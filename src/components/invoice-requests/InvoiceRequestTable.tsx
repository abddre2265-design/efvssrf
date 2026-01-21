import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Clock, CheckCircle, XCircle, FileCheck } from 'lucide-react';
import { InvoiceRequest } from './types';
import { motion } from 'framer-motion';

interface InvoiceRequestTableProps {
  requests: InvoiceRequest[];
  onView: (request: InvoiceRequest) => void;
  isLoading?: boolean;
}

export const InvoiceRequestTable: React.FC<InvoiceRequestTableProps> = ({
  requests,
  onView,
  isLoading = false,
}) => {
  const { t, language } = useLanguage();

  const getLocale = () => {
    switch (language) {
      case 'fr': return fr;
      case 'ar': return ar;
      default: return enUS;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
              <Clock className="h-3 w-3 mr-1" />
              {t('pending')}
            </Badge>
          </motion.div>
        );
      case 'processed':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('processed')}
          </Badge>
        );
      case 'converted':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <FileCheck className="h-3 w-3 mr-1" />
            {t('converted')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            {t('rejected')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string, paidAmount: number, totalTtc: number) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
            {t('paid')}
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">
            {t('partial')} ({paidAmount.toFixed(3)} / {totalTtc.toFixed(3)})
          </Badge>
        );
      case 'unpaid':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
            {t('unpaid')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getClientName = (request: InvoiceRequest) => {
    if (request.client_type === 'company') {
      return request.company_name || '-';
    }
    return `${request.first_name || ''} ${request.last_name || ''}`.trim() || '-';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{t('no_invoice_requests')}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('request_date')}</TableHead>
            <TableHead>{t('client')}</TableHead>
            <TableHead>{t('store')}</TableHead>
            <TableHead className="text-right">{t('total_ttc')}</TableHead>
            <TableHead>{t('payment_status')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead className="text-right">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                {format(new Date(request.request_date), 'dd/MM/yyyy HH:mm', { locale: getLocale() })}
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{getClientName(request)}</div>
                  <div className="text-xs text-muted-foreground">{request.identifier_value}</div>
                </div>
              </TableCell>
              <TableCell>{request.store?.name || '-'}</TableCell>
              <TableCell className="text-right font-mono">
                {request.total_ttc.toFixed(3)} TND
              </TableCell>
              <TableCell>
                {getPaymentStatusBadge(request.payment_status, request.paid_amount, request.total_ttc)}
              </TableCell>
              <TableCell>{getStatusBadge(request.status)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onView(request)}>
                  <Eye className="h-4 w-4 mr-1" />
                  {t('view')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
