import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Eye, Pencil, Copy, MoreHorizontal, History, Wallet, FileText } from 'lucide-react';
import { Client } from './types';
import { formatCurrency } from '@/components/invoices/types';

interface ClientTableProps {
  clients: Client[];
  onView: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDuplicate: (client: Client) => void;
  onHistory: (client: Client) => void;
  onAssignPayment: (client: Client) => void;
  onCreateInvoice: (client: Client) => void;
  isLoading?: boolean;
}

export const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  onView,
  onEdit,
  onDuplicate,
  onHistory,
  onAssignPayment,
  onCreateInvoice,
  isLoading = false,
}) => {
  const { t, isRTL } = useLanguage();

  const getClientName = (client: Client): string => {
    if (client.company_name) {
      return client.company_name;
    }
    return `${client.first_name || ''} ${client.last_name || ''}`.trim();
  };

  const getClientTypeBadge = (type: string) => {
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
    
    const variant = variants[type] || variants.individual_local;
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
          {t('active')}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/30">
        {t('archived')}
      </Badge>
    );
  };

  const formatPhone = (prefix: string | null, phone: string | null): string => {
    if (!phone) return '-';
    return prefix ? `${prefix} ${phone}` : phone;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('no_clients')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>{t('client_name')}</TableHead>
            <TableHead>{t('client_type')}</TableHead>
            <TableHead>{t('identifier')}</TableHead>
            <TableHead>{t('phone')}</TableHead>
            <TableHead>{t('email')}</TableHead>
            <TableHead>{t('balance')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead className="w-[80px]">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="hover:bg-muted/20">
              <TableCell className="font-medium">{getClientName(client)}</TableCell>
              <TableCell>{getClientTypeBadge(client.client_type)}</TableCell>
              <TableCell className="font-mono text-sm">{client.identifier_value}</TableCell>
              <TableCell>{formatPhone(client.phone_prefix, client.phone)}</TableCell>
              <TableCell>{client.email || '-'}</TableCell>
              <TableCell>
                <span className={client.account_balance > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                  {formatCurrency(client.account_balance, 'TND')}
                </span>
              </TableCell>
              <TableCell>{getStatusBadge(client.status)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                    <DropdownMenuItem onClick={() => onView(client)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('view')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(client)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(client)}>
                      <Copy className="mr-2 h-4 w-4" />
                      {t('duplicate')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onCreateInvoice(client)}>
                      <FileText className="mr-2 h-4 w-4" />
                      {t('create_invoice')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onHistory(client)}>
                      <History className="mr-2 h-4 w-4" />
                      {t('history')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAssignPayment(client)}>
                      <Wallet className="mr-2 h-4 w-4" />
                      {t('assign_payment')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
