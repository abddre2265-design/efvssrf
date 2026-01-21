import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/invoices/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Search,
  CalendarIcon,
  CreditCard,
  Banknote,
  Receipt,
  FileText,
  Building2,
  Globe,
  Wallet,
  Layers,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  Trash2,
  MoreHorizontal,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ArrowUpDown,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClientDepositDialog } from '@/components/payments/ClientDepositDialog';
import { ClientAccountDialog } from '@/components/payments/ClientAccountDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Payment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  withholding_rate: number;
  withholding_amount: number;
  net_amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  invoice?: {
    id: string;
    invoice_number: string;
    client_id: string;
    net_payable: number;
    currency: string;
    paid_amount: number;
    payment_status: string;
    client?: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      client_type: string;
    };
  };
}

interface ClientWithBalance {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  account_balance: number;
}

const PAYMENT_METHODS = [
  { value: 'cash', icon: Banknote },
  { value: 'card', icon: CreditCard },
  { value: 'check', icon: Receipt },
  { value: 'draft', icon: FileText },
  { value: 'iban_transfer', icon: Building2 },
  { value: 'swift_transfer', icon: Globe },
  { value: 'bank_deposit', icon: Wallet },
  { value: 'mixed', icon: Layers },
];

const Payments: React.FC = () => {
  const { t, language, isRTL } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clientsWithBalance, setClientsWithBalance] = useState<ClientWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('payments');
  
  // Filters
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortField, setSortField] = useState<'payment_date' | 'amount' | 'created_at'>('payment_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // View dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  
  // Client deposit dialog
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  
  // Client account dialog
  const [clientAccountOpen, setClientAccountOpen] = useState(false);
  const [selectedClientForAccount, setSelectedClientForAccount] = useState<ClientWithBalance | null>(null);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          invoice:invoices(
            id,
            invoice_number,
            client_id,
            net_payable,
            currency,
            paid_amount,
            payment_status,
            client:clients(id, first_name, last_name, company_name, client_type)
          )
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments((data || []) as unknown as Payment[]);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error(t('error_loading_payments'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientsWithBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_type, first_name, last_name, company_name, account_balance')
        .eq('status', 'active')
        .gt('account_balance', 0)
        .order('account_balance', { ascending: false });

      if (error) throw error;
      setClientsWithBalance((data || []) as ClientWithBalance[]);
    } catch (error) {
      console.error('Error fetching clients with balance:', error);
    }
  };

  const fetchAll = () => {
    fetchPayments();
    fetchClientsWithBalance();
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleViewClientAccount = (client: ClientWithBalance) => {
    setSelectedClientForAccount(client);
    setClientAccountOpen(true);
  };

  const getClientNameFromBalance = (client: ClientWithBalance) => {
    if (client.client_type === 'business_local') {
      return client.company_name || t('no_data');
    }
    return [client.first_name, client.last_name].filter(Boolean).join(' ') || t('no_data');
  };

  // Total client balances
  const totalClientBalances = useMemo(() => {
    return clientsWithBalance.reduce((sum, c) => sum + c.account_balance, 0);
  }, [clientsWithBalance]);

  // Statistics calculations
  const stats = useMemo(() => {
    const today = new Date();
    const thisMonth = payments.filter(p => {
      const pDate = new Date(p.payment_date);
      return pDate.getMonth() === today.getMonth() && pDate.getFullYear() === today.getFullYear();
    });
    const lastMonth = payments.filter(p => {
      const pDate = new Date(p.payment_date);
      const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return pDate.getMonth() === lastMonthDate.getMonth() && pDate.getFullYear() === lastMonthDate.getFullYear();
    });

    const thisMonthTotal = thisMonth.reduce((sum, p) => sum + p.amount, 0);
    const lastMonthTotal = lastMonth.reduce((sum, p) => sum + p.amount, 0);
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalWithholding = payments.reduce((sum, p) => sum + p.withholding_amount, 0);
    const avgPayment = payments.length > 0 ? totalPayments / payments.length : 0;
    
    const percentChange = lastMonthTotal > 0 
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 
      : thisMonthTotal > 0 ? 100 : 0;

    // Payment methods distribution
    const methodCounts: Record<string, number> = {};
    payments.forEach(p => {
      methodCounts[p.payment_method] = (methodCounts[p.payment_method] || 0) + 1;
    });

    return {
      totalPayments,
      thisMonthTotal,
      lastMonthTotal,
      percentChange,
      avgPayment,
      totalWithholding,
      count: payments.length,
      thisMonthCount: thisMonth.length,
      methodCounts,
    };
  }, [payments]);

  // Filtered and sorted payments
  const filteredPayments = useMemo(() => {
    let result = [...payments];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.invoice?.invoice_number?.toLowerCase().includes(query) ||
        p.reference_number?.toLowerCase().includes(query) ||
        p.invoice?.client?.company_name?.toLowerCase().includes(query) ||
        p.invoice?.client?.first_name?.toLowerCase().includes(query) ||
        p.invoice?.client?.last_name?.toLowerCase().includes(query) ||
        p.notes?.toLowerCase().includes(query)
      );
    }

    // Method filter
    if (methodFilter !== 'all') {
      result = result.filter(p => p.payment_method === methodFilter);
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter(p => new Date(p.payment_date) >= dateFrom);
    }
    if (dateTo) {
      const toDateEnd = new Date(dateTo);
      toDateEnd.setHours(23, 59, 59, 999);
      result = result.filter(p => new Date(p.payment_date) <= toDateEnd);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'created_at':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        default:
          aVal = new Date(a.payment_date).getTime();
          bVal = new Date(b.payment_date).getTime();
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [payments, searchQuery, methodFilter, dateFrom, dateTo, sortField, sortOrder]);

  const getPaymentMethodIcon = (method: string) => {
    const methodConfig = PAYMENT_METHODS.find(m => m.value === method);
    if (!methodConfig) return <CreditCard className="h-4 w-4" />;
    const Icon = methodConfig.icon;
    return <Icon className="h-4 w-4" />;
  };

  const getPaymentMethodLabel = (method: string) => {
    return t(`payment_method_${method}`);
  };

  const getClientName = (payment: Payment) => {
    const client = payment.invoice?.client;
    if (!client) return t('no_data');
    if (client.client_type === 'business_local') {
      return client.company_name || t('no_data');
    }
    return [client.first_name, client.last_name].filter(Boolean).join(' ') || t('no_data');
  };

  const handleView = (payment: Payment) => {
    setSelectedPayment(payment);
    setViewDialogOpen(true);
  };

  const handleDeleteRequest = (payment: Payment) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!paymentToDelete) return;

    try {
      const invoice = paymentToDelete.invoice;
      
      // Delete payment
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentToDelete.id);

      if (deleteError) throw deleteError;

      // Update invoice
      if (invoice) {
        const newPaidAmount = Math.max(0, (invoice.paid_amount || 0) - paymentToDelete.amount);
        const newPaymentStatus = newPaidAmount <= 0 ? 'unpaid' : newPaidAmount >= invoice.net_payable ? 'paid' : 'partial';

        const invoiceUpdate: Record<string, unknown> = {
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus,
        };

        // Reset withholding if this was the payment that applied it
        if (paymentToDelete.withholding_rate > 0 && paymentToDelete.withholding_amount > 0) {
          // Check if there are other payments with withholding
          const { data: otherPayments } = await supabase
            .from('payments')
            .select('id')
            .eq('invoice_id', invoice.id)
            .neq('id', paymentToDelete.id)
            .gt('withholding_amount', 0);

          if (!otherPayments || otherPayments.length === 0) {
            invoiceUpdate.withholding_rate = 0;
            invoiceUpdate.withholding_amount = 0;
            invoiceUpdate.withholding_applied = false;
          }
        }

        const { error: invoiceError } = await supabase
          .from('invoices')
          .update(invoiceUpdate)
          .eq('id', invoice.id);

        if (invoiceError) throw invoiceError;
      }

      toast.success(t('payment_deleted'));
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
      fetchPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error(t('error_deleting_payment'));
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setMethodFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = searchQuery || methodFilter !== 'all' || dateFrom || dateTo;

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 space-y-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('sales_payments')}</h1>
          <p className="text-muted-foreground">{t('manage_sales_payments')}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={() => setDepositDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('add_deposit')}
          </Button>
          <Button variant="outline" onClick={fetchAll} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Received */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('total_received')}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalPayments, 'TND')}</div>
            <p className="text-xs text-muted-foreground">
              {stats.count} {t('payments_count')}
            </p>
          </CardContent>
        </Card>

        {/* This Month */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('this_month')}
            </CardTitle>
            {stats.percentChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.thisMonthTotal, 'TND')}</div>
            <p className={cn(
              "text-xs",
              stats.percentChange >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {stats.percentChange >= 0 ? '+' : ''}{stats.percentChange.toFixed(1)}% {t('vs_last_month')}
            </p>
          </CardContent>
        </Card>

        {/* Average Payment */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('average_payment')}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgPayment, 'TND')}</div>
            <p className="text-xs text-muted-foreground">
              {stats.thisMonthCount} {t('this_month_payments')}
            </p>
          </CardContent>
        </Card>

        {/* Client Balances */}
        <Card className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('balances')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('client_balances')}
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalClientBalances, 'TND')}</div>
            <p className="text-xs text-muted-foreground">
              {clientsWithBalance.length} {t('clients_with_balance')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Payments and Client Balances */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            {t('invoice_payments')}
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-2">
            <Wallet className="h-4 w-4" />
            {t('client_accounts')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className={cn(
                "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
                isRTL ? "right-3" : "left-3"
              )} />
              <Input
                placeholder={t('search_payments')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(isRTL ? "pr-10" : "pl-10")}
              />
            </div>

            {/* Method Filter */}
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('payment_method')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_methods')}</SelectItem>
                {PAYMENT_METHODS.map(method => (
                  <SelectItem key={method.value} value={method.value}>
                    <div className="flex items-center gap-2">
                      <method.icon className="h-4 w-4" />
                      {t(`payment_method_${method.value}`)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : t('date_from')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  locale={getDateLocale()}
                />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'dd/MM/yyyy') : t('date_to')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  locale={getDateLocale()}
                />
              </PopoverContent>
            </Popover>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                <X className="h-4 w-4" />
                {t('clear_filters')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80"
                    onClick={() => toggleSort('payment_date')}
                  >
                    <div className="flex items-center gap-2">
                      {t('payment_date')}
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>{t('invoice')}</TableHead>
                  <TableHead>{t('client')}</TableHead>
                  <TableHead>{t('payment_method')}</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/80"
                    onClick={() => toggleSort('amount')}
                  >
                    <div className="flex items-center gap-2">
                      {t('amount')}
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>{t('withholding')}</TableHead>
                  <TableHead>{t('net_amount')}</TableHead>
                  <TableHead>{t('reference_number')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <CreditCard className="h-8 w-8" />
                        <p>{t('no_payments_yet')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredPayments.map((payment, index) => (
                      <motion.tr
                        key={payment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ delay: index * 0.02 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">
                          {format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: getDateLocale() })}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {payment.invoice?.invoice_number || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="truncate max-w-[150px] block">
                            {getClientName(payment)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1.5">
                            {getPaymentMethodIcon(payment.payment_method)}
                            {getPaymentMethodLabel(payment.payment_method)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payment.amount, payment.invoice?.currency || 'TND')}
                        </TableCell>
                        <TableCell>
                          {payment.withholding_amount > 0 ? (
                            <span className="text-amber-600">
                              -{formatCurrency(payment.withholding_amount, payment.invoice?.currency || 'TND')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          {formatCurrency(payment.net_amount, payment.invoice?.currency || 'TND')}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate max-w-[120px] block">
                            {payment.reference_number || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(payment)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('view')}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteRequest(payment)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground text-center">
          {filteredPayments.length} {t('payments_count')} {hasActiveFilters && `(${t('filtered')})`}
        </p>
      )}
        </TabsContent>

        {/* Client Balances Tab */}
        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="rounded-md border-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{t('client')}</TableHead>
                      <TableHead>{t('client_type')}</TableHead>
                      <TableHead>{t('account_balance')}</TableHead>
                      <TableHead className="w-[100px]">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsWithBalance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Wallet className="h-8 w-8" />
                            <p>{t('no_client_balances')}</p>
                            <Button variant="outline" size="sm" onClick={() => setDepositDialogOpen(true)}>
                              <Plus className="mr-2 h-4 w-4" />
                              {t('add_first_deposit')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientsWithBalance.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">
                            {getClientNameFromBalance(client)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {t(client.client_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-green-600">
                              {formatCurrency(client.account_balance, 'TND')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewClientAccount(client)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {t('view_account')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Payment Sheet */}
      <Sheet open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <SheetContent side={isRTL ? 'left' : 'right'} className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {t('payment_details')}
            </SheetTitle>
            <SheetDescription>
              {selectedPayment?.invoice?.invoice_number}
            </SheetDescription>
          </SheetHeader>
          
          {selectedPayment && (
            <ScrollArea className="h-[calc(100vh-120px)] mt-6">
              <div className="space-y-6 pr-4">
                {/* Payment Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    {t('payment_info')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('payment_date')}</p>
                      <p className="font-medium">
                        {format(new Date(selectedPayment.payment_date), 'dd MMMM yyyy', { locale: getDateLocale() })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('payment_method')}</p>
                      <Badge variant="secondary" className="gap-1.5">
                        {getPaymentMethodIcon(selectedPayment.payment_method)}
                        {getPaymentMethodLabel(selectedPayment.payment_method)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Amounts */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    {t('amounts')}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('gross_amount')}</span>
                      <span className="font-medium">{formatCurrency(selectedPayment.amount, selectedPayment.invoice?.currency || 'TND')}</span>
                    </div>
                    {selectedPayment.withholding_amount > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>{t('withholding')} ({selectedPayment.withholding_rate}%)</span>
                        <span>-{formatCurrency(selectedPayment.withholding_amount, selectedPayment.invoice?.currency || 'TND')}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold">{t('net_payment_amount')}</span>
                      <span className="font-bold text-green-600">{formatCurrency(selectedPayment.net_amount, selectedPayment.invoice?.currency || 'TND')}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Invoice Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    {t('invoice_info')}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('invoice_number')}</span>
                      <span className="font-mono">{selectedPayment.invoice?.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('client')}</span>
                      <span>{getClientName(selectedPayment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('invoice_total')}</span>
                      <span>{formatCurrency(selectedPayment.invoice?.net_payable || 0, selectedPayment.invoice?.currency || 'TND')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('payment_status')}</span>
                      <Badge variant={
                        selectedPayment.invoice?.payment_status === 'paid' ? 'default' :
                        selectedPayment.invoice?.payment_status === 'partial' ? 'secondary' : 'destructive'
                      }>
                        {t(`payment_${selectedPayment.invoice?.payment_status}`)}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Reference */}
                {selectedPayment.reference_number && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        {t('reference_number')}
                      </h3>
                      <p className="font-mono text-sm bg-muted p-3 rounded-lg break-all">
                        {selectedPayment.reference_number}
                      </p>
                    </div>
                  </>
                )}

                {/* Notes */}
                {selectedPayment.notes && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        {t('notes')}
                      </h3>
                      <p className="text-sm bg-muted p-3 rounded-lg">
                        {selectedPayment.notes}
                      </p>
                    </div>
                  </>
                )}

                {/* Created At */}
                <Separator />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {t('created_at')}: {format(new Date(selectedPayment.created_at), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() })}
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_payment')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{t('confirm_delete_payment')}</p>
              {paymentToDelete && (
                <div className="bg-muted p-3 rounded-lg space-y-1">
                  <p className="font-mono text-sm">{paymentToDelete.invoice?.invoice_number}</p>
                  <p className="font-medium">{formatCurrency(paymentToDelete.amount, paymentToDelete.invoice?.currency || 'TND')}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(paymentToDelete.payment_date), 'dd/MM/yyyy')}
                  </p>
                </div>
              )}
              <p className="text-sm text-amber-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {t('delete_payment_warning')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Deposit Dialog */}
      <ClientDepositDialog
        open={depositDialogOpen}
        onOpenChange={setDepositDialogOpen}
        onDepositComplete={fetchAll}
      />

      {/* Client Account Dialog */}
      <ClientAccountDialog
        open={clientAccountOpen}
        onOpenChange={setClientAccountOpen}
        client={selectedClientForAccount}
      />
    </motion.div>
  );
};

export default Payments;
