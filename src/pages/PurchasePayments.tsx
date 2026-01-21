import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/invoices/types';
import { PurchasePaymentDialog } from '@/components/purchases/PurchasePaymentDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DollarSign,
  Eye,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PurchasePayment {
  id: string;
  purchase_document_id: string;
  payment_date: string;
  amount: number;
  withholding_rate: number;
  withholding_amount: number;
  net_amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  purchase_document?: {
    id: string;
    invoice_number: string | null;
    supplier_id: string | null;
    net_payable: number;
    currency: string;
    paid_amount: number;
    payment_status: string;
    supplier?: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      supplier_type: string;
    };
  };
}

interface PurchaseDocument {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  supplier_id: string | null;
  subtotal_ht: number;
  total_vat: number;
  stamp_duty_amount: number;
  net_payable: number;
  currency: string;
  exchange_rate: number;
  paid_amount: number;
  payment_status: string;
  status: string;
  withholding_rate: number;
  withholding_amount: number;
  withholding_applied: boolean;
  supplier?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    supplier_type: string;
  };
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

const PurchasePayments: React.FC = () => {
  const { t, language, isRTL } = useLanguage();
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [unpaidDocuments, setUnpaidDocuments] = useState<PurchaseDocument[]>([]);
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
  const [selectedPayment, setSelectedPayment] = useState<PurchasePayment | null>(null);
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PurchasePayment | null>(null);
  
  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<PurchaseDocument | null>(null);

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
        .from('purchase_payments')
        .select(`
          *,
          purchase_document:purchase_documents(
            id,
            invoice_number,
            supplier_id,
            net_payable,
            currency,
            paid_amount,
            payment_status,
            supplier:suppliers(id, first_name, last_name, company_name, supplier_type)
          )
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments((data || []) as unknown as PurchasePayment[]);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error(t('error_loading_payments') || 'Erreur de chargement des paiements');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnpaidDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_documents')
        .select(`
          id,
          invoice_number,
          invoice_date,
          supplier_id,
          subtotal_ht,
          total_vat,
          stamp_duty_amount,
          net_payable,
          currency,
          exchange_rate,
          paid_amount,
          payment_status,
          status,
          withholding_rate,
          withholding_amount,
          withholding_applied,
          supplier:suppliers(id, first_name, last_name, company_name, supplier_type)
        `)
        .in('payment_status', ['unpaid', 'partial'])
        .eq('status', 'validated')
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setUnpaidDocuments((data || []) as unknown as PurchaseDocument[]);
    } catch (error) {
      console.error('Error fetching unpaid documents:', error);
    }
  };

  const fetchAll = () => {
    fetchPayments();
    fetchUnpaidDocuments();
  };

  useEffect(() => {
    fetchAll();
  }, []);

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

    // Unpaid totals
    const totalUnpaid = unpaidDocuments.reduce((sum, d) => sum + (d.net_payable - d.paid_amount), 0);

    return {
      totalPayments,
      thisMonthTotal,
      lastMonthTotal,
      percentChange,
      avgPayment,
      totalWithholding,
      count: payments.length,
      thisMonthCount: thisMonth.length,
      totalUnpaid,
      unpaidCount: unpaidDocuments.length,
    };
  }, [payments, unpaidDocuments]);

  // Filtered and sorted payments
  const filteredPayments = useMemo(() => {
    let result = [...payments];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.purchase_document?.invoice_number?.toLowerCase().includes(query) ||
        p.reference_number?.toLowerCase().includes(query) ||
        p.purchase_document?.supplier?.company_name?.toLowerCase().includes(query) ||
        p.purchase_document?.supplier?.first_name?.toLowerCase().includes(query) ||
        p.purchase_document?.supplier?.last_name?.toLowerCase().includes(query) ||
        p.notes?.toLowerCase().includes(query)
      );
    }

    if (methodFilter !== 'all') {
      result = result.filter(p => p.payment_method === methodFilter);
    }

    if (dateFrom) {
      result = result.filter(p => new Date(p.payment_date) >= dateFrom);
    }
    if (dateTo) {
      const toDateEnd = new Date(dateTo);
      toDateEnd.setHours(23, 59, 59, 999);
      result = result.filter(p => new Date(p.payment_date) <= toDateEnd);
    }

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
    const labels: Record<string, string> = {
      cash: 'Espèces',
      card: 'Carte',
      check: 'Chèque',
      draft: 'Traite',
      iban_transfer: 'Virement IBAN',
      swift_transfer: 'Virement SWIFT',
      bank_deposit: 'Dépôt bancaire',
      mixed: 'Mixte',
    };
    return labels[method] || method;
  };

  const getSupplierName = (payment: PurchasePayment) => {
    const supplier = payment.purchase_document?.supplier;
    if (!supplier) return 'N/A';
    if (supplier.supplier_type === 'business_local') {
      return supplier.company_name || 'N/A';
    }
    return [supplier.first_name, supplier.last_name].filter(Boolean).join(' ') || 'N/A';
  };

  const getDocumentSupplierName = (doc: PurchaseDocument) => {
    const supplier = doc.supplier;
    if (!supplier) return 'N/A';
    if (supplier.supplier_type === 'business_local') {
      return supplier.company_name || 'N/A';
    }
    return [supplier.first_name, supplier.last_name].filter(Boolean).join(' ') || 'N/A';
  };

  const handleView = (payment: PurchasePayment) => {
    setSelectedPayment(payment);
    setViewDialogOpen(true);
  };

  const handleDeleteRequest = (payment: PurchasePayment) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!paymentToDelete) return;

    try {
      const document = paymentToDelete.purchase_document;
      
      const { error: deleteError } = await supabase
        .from('purchase_payments')
        .delete()
        .eq('id', paymentToDelete.id);

      if (deleteError) throw deleteError;

      if (document) {
        const newPaidAmount = Math.max(0, (document.paid_amount || 0) - paymentToDelete.amount);
        const newPaymentStatus = newPaidAmount <= 0 ? 'unpaid' : newPaidAmount >= document.net_payable ? 'paid' : 'partial';

        const { error: docError } = await supabase
          .from('purchase_documents')
          .update({
            paid_amount: newPaidAmount,
            payment_status: newPaymentStatus,
          })
          .eq('id', document.id);

        if (docError) throw docError;
      }

      toast.success('Paiement supprimé');
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
      fetchAll();
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Erreur lors de la suppression du paiement');
    }
  };

  const handlePayDocument = (doc: PurchaseDocument) => {
    setSelectedDocument(doc);
    setPaymentDialogOpen(true);
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
          <h1 className="text-2xl font-bold">Paiements Achats</h1>
          <p className="text-muted-foreground">Gérez les paiements de vos factures d'achat</p>
        </div>
        
        <Button variant="outline" onClick={fetchAll} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total payé
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalPayments, 'TND')}</div>
            <p className="text-xs text-muted-foreground">
              {stats.count} paiements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ce mois
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.thisMonthTotal, 'TND')}</div>
            <p className="text-xs text-muted-foreground">
              {stats.thisMonthCount} paiements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Retenues à la source
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalWithholding, 'TND')}</div>
            <p className="text-xs text-muted-foreground">
              Total retenu
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Restant à payer
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {formatCurrency(stats.totalUnpaid, 'TND')}
            </div>
            <p className="text-xs text-orange-600/80">
              {stats.unpaidCount} factures en attente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="payments" className="gap-2">
            <Receipt className="h-4 w-4" />
            Historique des paiements
          </TabsTrigger>
          <TabsTrigger value="unpaid" className="gap-2">
            <Clock className="h-4 w-4" />
            Factures à payer
            {stats.unpaidCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {stats.unpaidCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Payments History Tab */}
        <TabsContent value="payments" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Mode de paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les modes</SelectItem>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {getPaymentMethodLabel(m.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Du'}
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

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Au'}
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

                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} size="icon">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payments Table */}
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => toggleSort('payment_date')}
                    >
                      <div className="flex items-center gap-2">
                        Date
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Facture</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead 
                      className="cursor-pointer text-right"
                      onClick={() => toggleSort('amount')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Montant
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Retenue</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucun paiement trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: getDateLocale() })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getSupplierName(payment)}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {payment.purchase_document?.invoice_number || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.payment_method)}
                            <span className="text-sm">{getPaymentMethodLabel(payment.payment_method)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(payment.amount, 'TND')}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {payment.withholding_amount > 0 ? formatCurrency(payment.withholding_amount, 'TND') : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(payment.net_amount, 'TND')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(payment)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir détails
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteRequest(payment)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Unpaid Documents Tab */}
        <TabsContent value="unpaid" className="space-y-4">
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>N° Facture</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Payé</TableHead>
                    <TableHead className="text-right">Restant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        Toutes les factures sont payées !
                      </TableCell>
                    </TableRow>
                  ) : (
                    unpaidDocuments.map((doc) => {
                      const remaining = doc.net_payable - doc.paid_amount;
                      return (
                        <TableRow key={doc.id}>
                          <TableCell>
                            {doc.invoice_date ? format(new Date(doc.invoice_date), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell className="font-mono">
                            {doc.invoice_number || 'N/A'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {getDocumentSupplierName(doc)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(doc.net_payable, doc.currency)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(doc.paid_amount, doc.currency)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-orange-600">
                            {formatCurrency(remaining, doc.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={doc.payment_status === 'partial' ? 'secondary' : 'destructive'}>
                              {doc.payment_status === 'partial' ? 'Partiel' : 'Non payé'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              onClick={() => handlePayDocument(doc)}
                              className="gap-2"
                            >
                              <Wallet className="h-4 w-4" />
                              Payer
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Payment Sheet */}
      <Sheet open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Détails du paiement</SheetTitle>
            <SheetDescription>
              Informations complètes sur ce paiement
            </SheetDescription>
          </SheetHeader>
          
          {selectedPayment && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedPayment.payment_date), 'dd MMMM yyyy', { locale: getDateLocale() })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mode de paiement</p>
                  <div className="flex items-center gap-2">
                    {getPaymentMethodIcon(selectedPayment.payment_method)}
                    <span className="font-medium">{getPaymentMethodLabel(selectedPayment.payment_method)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fournisseur</p>
                  <p className="font-medium">{getSupplierName(selectedPayment)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Facture</p>
                  <p className="font-mono">{selectedPayment.purchase_document?.invoice_number || 'N/A'}</p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant brut</span>
                  <span className="font-medium">{formatCurrency(selectedPayment.amount, 'TND')}</span>
                </div>
                {selectedPayment.withholding_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retenue ({selectedPayment.withholding_rate}%)</span>
                    <span className="font-medium text-orange-600">
                      -{formatCurrency(selectedPayment.withholding_amount, 'TND')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Montant net payé</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedPayment.net_amount, 'TND')}</span>
                </div>
              </div>

              {selectedPayment.reference_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Référence</p>
                  <p className="font-mono">{selectedPayment.reference_number}</p>
                </div>
              )}

              {selectedPayment.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedPayment.notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le montant sera déduit du total payé de la facture.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog - Simple inline version */}
      <PurchasePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        document={selectedDocument}
        onPaymentComplete={() => {
          setPaymentDialogOpen(false);
          fetchAll();
        }}
      />
    </motion.div>
  );
};

export default PurchasePayments;
