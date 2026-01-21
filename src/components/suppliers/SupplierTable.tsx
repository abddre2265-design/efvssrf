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
} from '@/components/ui/dropdown-menu';
import { Eye, Pencil, Copy, MoreHorizontal, History } from 'lucide-react';
import { Supplier } from './types';

interface SupplierTableProps {
  suppliers: Supplier[];
  onView: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onDuplicate: (supplier: Supplier) => void;
  onHistory: (supplier: Supplier) => void;
  isLoading?: boolean;
}

export const SupplierTable: React.FC<SupplierTableProps> = ({
  suppliers,
  onView,
  onEdit,
  onDuplicate,
  onHistory,
  isLoading = false,
}) => {
  const { t, isRTL } = useLanguage();

  const getSupplierName = (supplier: Supplier): string => {
    if (supplier.company_name) {
      return supplier.company_name;
    }
    return `${supplier.first_name || ''} ${supplier.last_name || ''}`.trim();
  };

  const getSupplierTypeBadge = (type: string) => {
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
        label: t('foreign_supplier'),
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

  if (suppliers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('no_suppliers')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>{t('supplier_name')}</TableHead>
            <TableHead>{t('supplier_type')}</TableHead>
            <TableHead>{t('identifier')}</TableHead>
            <TableHead>{t('phone')}</TableHead>
            <TableHead>{t('email')}</TableHead>
            <TableHead>{t('country')}</TableHead>
            <TableHead>{t('address')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead className="w-[80px]">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id} className="hover:bg-muted/20">
              <TableCell className="font-medium">{getSupplierName(supplier)}</TableCell>
              <TableCell>{getSupplierTypeBadge(supplier.supplier_type)}</TableCell>
              <TableCell className="font-mono text-sm">{supplier.identifier_value || '-'}</TableCell>
              <TableCell>{formatPhone(supplier.phone_prefix, supplier.phone)}</TableCell>
              <TableCell>{supplier.email || '-'}</TableCell>
              <TableCell>{supplier.country}</TableCell>
              <TableCell className="max-w-[150px] truncate">
                {supplier.address || '-'}
              </TableCell>
              <TableCell>{getStatusBadge(supplier.status)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                    <DropdownMenuItem onClick={() => onView(supplier)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('view')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(supplier)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onHistory(supplier)}>
                      <History className="mr-2 h-4 w-4" />
                      {t('history')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(supplier)}>
                      <Copy className="mr-2 h-4 w-4" />
                      {t('duplicate')}
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
