import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  Banknote,
  Receipt,
  Building2,
  Globe,
} from 'lucide-react';
import { formatCurrency } from '@/components/invoices/types';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  account_balance: number;
}

interface Movement {
  id: string;
  movement_type: string;
  amount: number;
  balance_after: number;
  source_type: string;
  source_id: string | null;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  movement_date: string;
  created_at: string;
}

interface ClientAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

const PAYMENT_METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  check: Receipt,
  draft: FileText,
  iban_transfer: Building2,
  swift_transfer: Globe,
  bank_deposit: Wallet,
};

export const ClientAccountDialog: React.FC<ClientAccountDialogProps> = ({
  open,
  onOpenChange,
  client,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  useEffect(() => {
    if (open && client) {
      fetchMovements();
    }
  }, [open, client]);

  const fetchMovements = async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_account_movements')
        .select('*')
        .eq('client_id', client.id)
        .order('movement_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getClientName = (client: Client) => {
    if (client.client_type === 'business_local') {
      return client.company_name || t('no_data');
    }
    return [client.first_name, client.last_name].filter(Boolean).join(' ') || t('no_data');
  };

  const getSourceTypeLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'direct_deposit':
        return t('direct_deposit');
      case 'invoice_payment':
        return t('invoice_payment');
      case 'refund':
        return t('refund');
      case 'credit_note':
        return t('credit_note');
      case 'credit_note_unblock':
        return t('credit_note_unblock');
      default:
        return sourceType;
    }
  };

  const getPaymentMethodIcon = (method: string | null) => {
    if (!method) return null;
    const Icon = PAYMENT_METHOD_ICONS[method] || CreditCard;
    return <Icon className="h-4 w-4" />;
  };

  // Calculate totals - separate credit notes from deposits
  const totalFromCreditNotes = movements
    .filter(m => m.movement_type === 'credit' && (m.source_type === 'credit_note' || m.source_type === 'credit_note_unblock'))
    .reduce((sum, m) => sum + m.amount, 0);
  
  const totalFromDeposits = movements
    .filter(m => m.movement_type === 'credit' && m.source_type === 'direct_deposit')
    .reduce((sum, m) => sum + m.amount, 0);
  
  const totalCredits = movements
    .filter(m => m.movement_type === 'credit')
    .reduce((sum, m) => sum + m.amount, 0);
  
  const totalDebits = movements
    .filter(m => m.movement_type === 'debit')
    .reduce((sum, m) => sum + m.amount, 0);

  if (!client) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isRTL ? 'left' : 'right'} className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {t('client_account')}
          </SheetTitle>
          <SheetDescription>
            {getClientName(client)}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Balance Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{t('current_balance')}</p>
                <p className={cn(
                  "text-xl font-bold",
                  client.account_balance >= 0 ? "text-emerald-600" : "text-destructive"
                )}>
                  {formatCurrency(client.account_balance, 'TND')}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                  <TrendingDown className="h-3 w-3 text-amber-600" />
                  {t('total_debits')}
                </p>
                <p className="text-xl font-bold text-amber-600">
                  -{formatCurrency(totalDebits, 'TND')}
                </p>
              </div>
            </div>

            {/* Credit Sources Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-blue-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('credit_from_avoirs')}</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(totalFromCreditNotes, 'TND')}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t('credit_notes_description')}</p>
              </div>
              <div className="rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('credit_from_deposits')}</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatCurrency(totalFromDeposits, 'TND')}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t('deposits_description')}</p>
              </div>
            </div>

            <Separator />

            {/* Movements Table */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                {t('account_movements')}
              </h3>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{t('date')}</TableHead>
                      <TableHead>{t('type')}</TableHead>
                      <TableHead>{t('amount')}</TableHead>
                      <TableHead>{t('balance')}</TableHead>
                      <TableHead>{t('source')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Wallet className="h-8 w-8" />
                            <p>{t('no_movements')}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell className="font-medium">
                            {format(new Date(movement.movement_date), 'dd/MM/yyyy', { locale: getDateLocale() })}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={movement.movement_type === 'credit' ? 'default' : 'secondary'}
                              className={cn(
                                "gap-1",
                                movement.movement_type === 'credit' 
                                  ? "bg-green-500/10 text-green-600 border-green-500/20" 
                                  : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                              )}
                            >
                              {movement.movement_type === 'credit' ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {movement.movement_type === 'credit' ? t('account_credit') : t('debit')}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn(
                            "font-medium",
                            movement.movement_type === 'credit' ? "text-green-600" : "text-orange-600"
                          )}>
                            {movement.movement_type === 'credit' ? '+' : '-'}
                            {formatCurrency(movement.amount, 'TND')}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(movement.balance_after, 'TND')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {movement.payment_method && getPaymentMethodIcon(movement.payment_method)}
                              <span className="text-sm text-muted-foreground">
                                {getSourceTypeLabel(movement.source_type)}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
