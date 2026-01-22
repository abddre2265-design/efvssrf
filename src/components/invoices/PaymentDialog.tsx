import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CalendarIcon, 
  Loader2, 
  CreditCard, 
  Banknote, 
  Receipt, 
  FileText,
  Building2,
  Globe,
  Wallet,
  Layers,
  Trash2,
  Plus,
  X,
  AlertCircle,
  Lock,
  PiggyBank,
  Calculator,
  CheckCircle2,
  Settings2,
  Percent,
  RefreshCw,
  Coins
} from 'lucide-react';
import { Invoice, formatCurrency, CURRENCIES } from './types';
import { useTaxRates, DEFAULT_WITHHOLDING_RATES } from '@/hooks/useTaxRates';

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  withholding_rate: number;
  withholding_amount: number;
  net_amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

interface MixedPaymentLine {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onPaymentComplete: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', icon: Banknote, requiresReference: false },
  { value: 'card', icon: CreditCard, requiresReference: false },
  { value: 'check', icon: Receipt, requiresReference: true },
  { value: 'draft', icon: FileText, requiresReference: true },
  { value: 'iban_transfer', icon: Building2, requiresReference: true },
  { value: 'swift_transfer', icon: Globe, requiresReference: true },
  { value: 'bank_deposit', icon: Wallet, requiresReference: true },
  { value: 'client_credit_note', icon: FileText, requiresReference: false },
  { value: 'client_deposit', icon: PiggyBank, requiresReference: false },
  { value: 'mixed', icon: Layers, requiresReference: false },
];

const MIXED_PAYMENT_METHODS = PAYMENT_METHODS.filter(m => m.value !== 'mixed' && m.value !== 'client_credit_note' && m.value !== 'client_deposit');

// Available currencies for foreign payments (most common)
const FOREIGN_CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'AED', 'SAR', 'QAR', 'MAD', 'TRY', 'CNY'];

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onOpenChange,
  invoice,
  onPaymentComplete,
}) => {
  const { t, language, isRTL } = useLanguage();
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<string>('config');
  
  // Client balance state - separated by source
  const [clientBalance, setClientBalance] = useState<number>(0);
  const [creditNoteBalance, setCreditNoteBalance] = useState<number>(0);
  const [depositBalance, setDepositBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // Withholding configuration state (Step 1 for local clients)
  const [selectedWithholdingRate, setSelectedWithholdingRate] = useState<string>('');
  
  // Currency/Exchange rate configuration state (Step 1 for foreign clients)
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [exchangeRate, setExchangeRate] = useState<string>('1');
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  
  // Payment form state (Step 2)
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<string>('');
  const [paymentExchangeRate, setPaymentExchangeRate] = useState<string>('1');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // Mixed payment state
  const [mixedLines, setMixedLines] = useState<MixedPaymentLine[]>([]);
  
  // Dynamic withholding rates from Taxes page
  const { withholdingRates } = useTaxRates(organizationId);

  // Fetch organization ID
  useEffect(() => {
    const fetchOrg = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('organizations')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) setOrganizationId(data.id);
      }
    };
    if (open) fetchOrg();
  }, [open]);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const generateLineId = () => Math.random().toString(36).substring(2, 9);

  // Invoice type
  const isForeign = invoice?.client_type === 'foreign';

  // Withholding status from invoice (only for local)
  const isWithholdingConfigured = !isForeign && (invoice?.withholding_applied || false);
  const invoiceWithholdingRate = invoice?.withholding_rate || 0;
  const invoiceWithholdingAmount = invoice?.withholding_amount || 0;

  // Currency configuration status (for foreign)
  const isCurrencyConfigured = isForeign && invoice?.exchange_rate && invoice.exchange_rate > 0;
  const invoiceCurrency = invoice?.currency || 'EUR';
  const invoiceExchangeRate = invoice?.exchange_rate || 1;

  // Calculate the adjusted net payable based on withholding applied to HT
  // Formula: Net à payer = (Total HT - Montant retenue) + TVA + Timbre fiscal
  const calculateAdjustedNetPayable = (inv: Invoice | null): number => {
    if (!inv) return 0;
    
    // For foreign invoices: just the subtotal HT (no VAT, no stamp duty, no withholding)
    if (inv.client_type === 'foreign') {
      return inv.subtotal_ht;
    }
    
    // For local clients: Apply withholding formula
    const withholdingOnHT = inv.withholding_applied 
      ? inv.subtotal_ht * (inv.withholding_rate / 100)
      : 0;
    
    // Local clients: (HT - Retenue) + TVA + Timbre
    const adjustedHT = inv.subtotal_ht - withholdingOnHT;
    return adjustedHT + inv.total_vat + (inv.stamp_duty_enabled ? inv.stamp_duty_amount : 0);
  };

  const adjustedNetPayable = calculateAdjustedNetPayable(invoice);
  const paidAmount = invoice?.paid_amount || 0;
  const remainingBalance = Math.max(0, adjustedNetPayable - paidAmount);
  
  // Convert amounts for foreign clients
  const remainingBalanceInTND = isForeign ? remainingBalance * invoiceExchangeRate : remainingBalance;
  
  // Check if payments exist (blocks withholding modification)
  const hasPayments = payments.length > 0;

  // Fetch live exchange rate
  const fetchExchangeRate = async (currency: string) => {
    if (currency === 'TND') {
      setExchangeRate('1');
      return;
    }
    
    setIsLoadingExchangeRate(true);
    try {
      // Try to get from our exchange_rates table first
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .single();
      
      if (orgData) {
        const { data: rateData } = await supabase
          .from('exchange_rates')
          .select('rate')
          .eq('organization_id', orgData.id)
          .eq('from_currency', currency)
          .eq('to_currency', 'TND')
          .single();
        
        if (rateData) {
          setExchangeRate(rateData.rate.toString());
          return;
        }
      }
      
      // Default rates if not found
      const defaultRates: Record<string, number> = {
        EUR: 3.4,
        USD: 3.1,
        GBP: 3.9,
        CAD: 2.3,
        CHF: 3.5,
        AED: 0.84,
        SAR: 0.83,
        QAR: 0.85,
        MAD: 0.31,
        TRY: 0.09,
        CNY: 0.43,
      };
      
      setExchangeRate((defaultRates[currency] || 1).toString());
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      setExchangeRate('1');
    } finally {
      setIsLoadingExchangeRate(false);
    }
  };

  // Load payments and client balance when dialog opens
  useEffect(() => {
    if (open && invoice) {
      loadPayments();
      loadClientBalance();
      
      if (isForeign) {
        // For foreign clients: set currency and exchange rate from invoice
        setSelectedCurrency(invoice.currency || 'EUR');
        setExchangeRate((invoice.exchange_rate || 1).toString());
        setPaymentExchangeRate((invoice.exchange_rate || 1).toString());
      } else {
        // For local clients: set withholding rate
        setSelectedWithholdingRate(invoice.withholding_applied ? String(invoice.withholding_rate) : '');
      }
      
      // Reset payment form
      setPaymentMethod('');
      setReferenceNumber('');
      setNotes('');
      setPaymentDate(new Date());
      setMixedLines([]);
      
      // Default to config tab if not configured, otherwise payment tab
      if (isForeign) {
        setActiveTab(isCurrencyConfigured ? 'payment' : 'config');
      } else {
        setActiveTab(invoice.withholding_applied ? 'payment' : 'config');
      }
    }
  }, [open, invoice]);

  // Update amount when remaining balance changes
  useEffect(() => {
    if (invoice && open) {
      setAmount(remainingBalance > 0 ? remainingBalance.toFixed(3) : '0');
    }
  }, [remainingBalance, open]);

  // Fetch exchange rate when currency changes (for foreign)
  useEffect(() => {
    if (isForeign && selectedCurrency && open) {
      fetchExchangeRate(selectedCurrency);
    }
  }, [selectedCurrency, isForeign, open]);

  // Load client balance - separated by source (credit notes vs deposits)
  const loadClientBalance = async () => {
    if (!invoice?.client_id) return;
    setIsLoadingBalance(true);
    try {
      // Get total balance from client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('account_balance')
        .eq('id', invoice.client_id)
        .single();
      
      if (clientError) throw clientError;
      const totalBalance = clientData?.account_balance || 0;
      setClientBalance(totalBalance);
      
      // Get movements to calculate breakdown
      const { data: movements, error: movementsError } = await supabase
        .from('client_account_movements')
        .select('movement_type, amount, source_type')
        .eq('client_id', invoice.client_id);
      
      if (movementsError) throw movementsError;
      
      // Calculate credits from each source
      const creditNoteCredits = movements
        ?.filter(m => m.movement_type === 'credit' && (m.source_type === 'credit_note' || m.source_type === 'credit_note_unblock'))
        .reduce((sum, m) => sum + m.amount, 0) || 0;
      
      const depositCredits = movements
        ?.filter(m => m.movement_type === 'credit' && m.source_type === 'direct_deposit')
        .reduce((sum, m) => sum + m.amount, 0) || 0;
      
      // Calculate all debits
      const totalDebits = movements
        ?.filter(m => m.movement_type === 'debit')
        .reduce((sum, m) => sum + m.amount, 0) || 0;
      
      // Distribute the current balance proportionally based on credit sources
      // Or prioritize: first use deposits, then credit notes
      const totalCredits = creditNoteCredits + depositCredits;
      if (totalCredits > 0 && totalBalance > 0) {
        // Distribute remaining balance proportionally
        const availableCreditNotes = Math.max(0, (creditNoteCredits / totalCredits) * totalBalance);
        const availableDeposits = Math.max(0, (depositCredits / totalCredits) * totalBalance);
        setCreditNoteBalance(availableCreditNotes);
        setDepositBalance(availableDeposits);
      } else {
        setCreditNoteBalance(0);
        setDepositBalance(0);
      }
    } catch (error: any) {
      console.error('Error loading client balance:', error);
      setClientBalance(0);
      setCreditNoteBalance(0);
      setDepositBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // When switching to mixed mode, initialize with one empty line
  useEffect(() => {
    if (paymentMethod === 'mixed' && mixedLines.length === 0) {
      setMixedLines([{ id: generateLineId(), method: '', amount: '', referenceNumber: '' }]);
    } else if (paymentMethod !== 'mixed') {
      setMixedLines([]);
    }
  }, [paymentMethod]);

  const loadPayments = async () => {
    if (!invoice) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      console.error('Error loading payments:', error);
      toast.error(t('error_loading_payments'));
    } finally {
      setIsLoading(false);
    }
  };

  const selectedMethod = PAYMENT_METHODS.find(m => m.value === paymentMethod);
  const requiresReference = selectedMethod?.requiresReference || false;
  const isMixedPayment = paymentMethod === 'mixed';
  const isClientCreditNotePayment = paymentMethod === 'client_credit_note';
  const isClientDepositPayment = paymentMethod === 'client_deposit';
  const isClientBalancePayment = isClientCreditNotePayment || isClientDepositPayment;
  
  // Maximum amount when using credit note balance
  const maxCreditNoteAmount = Math.min(creditNoteBalance, remainingBalanceInTND);
  // Maximum amount when using deposit balance
  const maxDepositAmount = Math.min(depositBalance, remainingBalanceInTND);
  // Total client balance for validation
  const maxClientBalanceAmount = Math.min(clientBalance, remainingBalanceInTND);

  const parsedAmount = parseFloat(amount) || 0;
  const parsedPaymentExchangeRate = parseFloat(paymentExchangeRate) || 1;
  
  // For foreign: amount in TND
  const amountInTND = isForeign ? parsedAmount * parsedPaymentExchangeRate : parsedAmount;

  // Calculate mixed lines total
  const mixedLinesTotal = mixedLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  const mixedAmountDifference = (isForeign ? amountInTND : parsedAmount) - mixedLinesTotal;
  const isMixedAmountValid = Math.abs(mixedAmountDifference) < 0.001;

  // Validate mixed lines
  const areMixedLinesValid = mixedLines.every(line => {
    const method = MIXED_PAYMENT_METHODS.find(m => m.value === line.method);
    if (!method) return false;
    if (parseFloat(line.amount) <= 0) return false;
    if (method.requiresReference && !line.referenceNumber.trim()) return false;
    return true;
  });

  // Validation for client balance payment (in TND)
  const getMaxBalanceForMethod = () => {
    if (isClientCreditNotePayment) return creditNoteBalance;
    if (isClientDepositPayment) return depositBalance;
    return clientBalance;
  };
  
  const isClientBalanceValid = isClientBalancePayment 
    ? (amountInTND > 0 && amountInTND <= getMaxBalanceForMethod() && parsedAmount <= remainingBalance)
    : true;

  const canSavePayment = isMixedPayment
    ? (mixedLines.length > 0 && areMixedLinesValid && isMixedAmountValid && parsedAmount > 0 && parsedAmount <= remainingBalance && paymentDate)
    : isClientBalancePayment
      ? (isClientBalanceValid && paymentDate)
      : (paymentMethod && parsedAmount > 0 && parsedAmount <= remainingBalance && (!requiresReference || referenceNumber.trim()) && paymentDate);

  // Can save withholding: rate must be selected and no payments exist (local only)
  const canSaveWithholding = !isForeign && selectedWithholdingRate !== '' && !hasPayments;
  
  // Can save currency config: currency and rate must be set (foreign only)
  const canSaveCurrencyConfig = isForeign && selectedCurrency && parseFloat(exchangeRate) > 0;
  
  // Can modify withholding: no payments exist
  const canModifyWithholding = !hasPayments;
  
  // Can modify currency: never (once set, currency cannot be changed if payments exist)
  // But exchange rate can be modified per payment
  const canModifyCurrency = !hasPayments;

  // Mixed payment line handlers
  const addMixedLine = () => {
    setMixedLines([...mixedLines, { id: generateLineId(), method: '', amount: '', referenceNumber: '' }]);
  };

  const removeMixedLine = (id: string) => {
    if (mixedLines.length > 1) {
      setMixedLines(mixedLines.filter(line => line.id !== id));
    }
  };

  const updateMixedLine = (id: string, field: keyof MixedPaymentLine, value: string) => {
    setMixedLines(mixedLines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  // Build reference string for mixed payment
  const buildMixedReference = (): string => {
    return mixedLines.map(line => {
      const method = MIXED_PAYMENT_METHODS.find(m => m.value === line.method);
      const label = getPaymentMethodLabel(line.method);
      const amt = formatCurrency(parseFloat(line.amount) || 0, 'TND');
      if (method?.requiresReference && line.referenceNumber) {
        return `${label}: ${amt} (${line.referenceNumber})`;
      }
      return `${label}: ${amt}`;
    }).join(' | ');
  };

  // Save configuration (withholding for local, currency for foreign)
  const handleSaveConfig = async () => {
    if (!invoice) return;

    setIsSavingConfig(true);
    try {
      if (isForeign) {
        // Save currency and exchange rate for foreign client
        const rate = parseFloat(exchangeRate) || 1;
        
        const { error } = await supabase
          .from('invoices')
          .update({
            currency: selectedCurrency,
            exchange_rate: rate,
            net_payable: invoice.subtotal_ht, // For foreign, net_payable = subtotal_ht
          })
          .eq('id', invoice.id);

        if (error) throw error;
        
        // Update payment exchange rate to match
        setPaymentExchangeRate(rate.toString());
        
        toast.success(t('currency_config_saved'));
      } else {
        // Save withholding for local client
        if (!canSaveWithholding) return;
        
        const rate = parseFloat(selectedWithholdingRate) || 0;
        const withholdingAmount = invoice.subtotal_ht * (rate / 100);
        
        // Calculate new net_payable based on the formula
        const newNetPayable = rate > 0
          ? (invoice.subtotal_ht - withholdingAmount) + invoice.total_vat + (invoice.stamp_duty_enabled ? invoice.stamp_duty_amount : 0)
          : invoice.total_ttc + (invoice.stamp_duty_enabled ? invoice.stamp_duty_amount : 0);

        const { error } = await supabase
          .from('invoices')
          .update({
            withholding_rate: rate,
            withholding_amount: withholdingAmount,
            withholding_applied: true,
            net_payable: newNetPayable,
          })
          .eq('id', invoice.id);

        if (error) throw error;

        toast.success(t('withholding_saved'));
      }
      
      onPaymentComplete();
      setActiveTab('payment');
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(isForeign ? t('error_saving_currency_config') : t('error_saving_withholding'));
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSavePayment = async () => {
    if (!invoice || !canSavePayment) return;

    setIsSaving(true);
    try {
      // Build reference number based on payment type
      let finalReference = referenceNumber.trim() || null;
      if (isMixedPayment) {
        finalReference = buildMixedReference();
      }
      
      // For foreign clients, include exchange rate in notes
      let finalNotes = notes.trim() || null;
      if (isForeign) {
        const rateNote = `${t('exchange_rate')}: 1 ${invoiceCurrency} = ${parsedPaymentExchangeRate} TND`;
        finalNotes = finalNotes ? `${finalNotes}\n${rateNote}` : rateNote;
      }

      // Insert payment (amount is always in invoice currency, net_amount is in TND for foreign)
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoice.id,
          payment_date: format(paymentDate, 'yyyy-MM-dd'),
          amount: parsedAmount, // Amount in invoice currency
          withholding_rate: 0,
          withholding_amount: 0,
          net_amount: isForeign ? amountInTND : parsedAmount, // For foreign: TND equivalent
          payment_method: paymentMethod,
          reference_number: finalReference,
          notes: finalNotes,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // If using client balance (credit note or deposit), create a debit movement (always in TND)
      if (isClientBalancePayment && paymentData) {
        const debitAmount = isForeign ? amountInTND : parsedAmount;
        const newBalance = clientBalance - debitAmount;
        
        // Determine the source type based on payment method
        const debitSourceType = isClientCreditNotePayment ? 'credit_note_payment' : 'deposit_payment';
        const notePrefix = isClientCreditNotePayment ? t('payment_method_client_credit_note') : t('payment_method_client_deposit');
        
        const { error: movementError } = await supabase
          .from('client_account_movements')
          .insert({
            client_id: invoice.client_id,
            organization_id: invoice.organization_id,
            movement_type: 'debit',
            amount: debitAmount,
            balance_after: newBalance,
            source_type: debitSourceType,
            source_id: invoice.id,
            notes: `${notePrefix}: ${t('payment_for_invoice')} ${invoice.invoice_number}`,
            movement_date: format(paymentDate, 'yyyy-MM-dd'),
          });

        if (movementError) throw movementError;
        
        setClientBalance(newBalance);
      }

      // Calculate new paid amount based on adjusted net payable
      const currentAdjustedNetPayable = calculateAdjustedNetPayable(invoice);
      const newPaidAmount = paidAmount + parsedAmount;
      const newPaymentStatus = newPaidAmount >= currentAdjustedNetPayable ? 'paid' : 'partial';

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus,
        })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      toast.success(t('payment_saved'));
      
      // Reload payments list first
      await loadPayments();
      await loadClientBalance();
      
      // Reset form for potential next payment
      setAmount((currentAdjustedNetPayable - newPaidAmount) > 0 ? (currentAdjustedNetPayable - newPaidAmount).toFixed(3) : '0');
      setPaymentMethod('');
      setReferenceNumber('');
      setNotes('');
      setMixedLines([]);
      
      // Notify parent to refresh data
      onPaymentComplete();
      
      // Only close dialog if fully paid
      if (newPaymentStatus === 'paid') {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Error saving payment:', error);
      toast.error(t('error_saving_payment'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    if (!invoice) return;

    try {
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', payment.id);

      if (deleteError) throw deleteError;

      // Calculate new status
      const currentAdjustedNetPayable = calculateAdjustedNetPayable(invoice);
      const newPaidAmount = Math.max(0, paidAmount - payment.amount);
      const newPaymentStatus = newPaidAmount <= 0 ? 'unpaid' : newPaidAmount >= currentAdjustedNetPayable ? 'paid' : 'partial';

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus,
        })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      toast.success(t('payment_deleted'));
      await loadPayments();
      onPaymentComplete();
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast.error(t('error_deleting_payment'));
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    return t(`payment_method_${method}`);
  };

  const getPaymentMethodIcon = (method: string) => {
    const methodConfig = PAYMENT_METHODS.find(m => m.value === method);
    if (!methodConfig) return null;
    const Icon = methodConfig.icon;
    return <Icon className="h-4 w-4" />;
  };

  if (!invoice) return null;

  // Calculate preview of withholding impact (for local clients)
  const previewWithholdingRate = parseFloat(selectedWithholdingRate) || 0;
  const previewWithholdingAmount = invoice.subtotal_ht * (previewWithholdingRate / 100);
  const previewAdjustedHT = invoice.subtotal_ht - previewWithholdingAmount;
  const previewNetPayable = isForeign 
    ? invoice.subtotal_ht
    : previewAdjustedHT + invoice.total_vat + (invoice.stamp_duty_enabled ? invoice.stamp_duty_amount : 0);

  // Preview for foreign currency
  const previewExchangeRate = parseFloat(exchangeRate) || 1;
  const previewAmountInTND = invoice.subtotal_ht * previewExchangeRate;

  // Get currency info
  const getCurrencySymbol = (code: string) => {
    const curr = CURRENCIES.find(c => c.code === code);
    return curr?.symbol || code;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side={isRTL ? 'left' : 'right'} 
        className="w-full sm:max-w-xl p-0 flex flex-col"
      >
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {t('payment_for_invoice')}
          </SheetTitle>
          <SheetDescription className="font-mono text-base flex items-center gap-2">
            {invoice.invoice_number}
            {isForeign && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400">
                <Globe className="h-3 w-3 mr-1" />
                {t('foreign')}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Invoice Summary */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Original Invoice Values */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t('original_invoice')}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subtotal_ht')}:</span>
                      <span className="font-mono">{formatCurrency(invoice.subtotal_ht, isForeign ? invoiceCurrency : 'TND')}</span>
                    </div>
                    {!isForeign && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('total_vat')}:</span>
                        <span className="font-mono">{formatCurrency(invoice.total_vat, 'TND')}</span>
                      </div>
                    )}
                    {!isForeign && invoice.stamp_duty_enabled && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('stamp_duty')}:</span>
                        <span className="font-mono">{formatCurrency(invoice.stamp_duty_amount, 'TND')}</span>
                      </div>
                    )}
                    {!isForeign && (
                      <div className="flex justify-between pt-1 border-t">
                        <span className="text-muted-foreground">{t('total_ttc')}:</span>
                        <span className="font-mono font-medium">{formatCurrency(invoice.total_ttc + (invoice.stamp_duty_enabled ? invoice.stamp_duty_amount : 0), 'TND')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Adjusted Values */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {isForeign ? t('currency_conversion') : t('after_withholding_adjustment')}
                  </p>
                  <div className="space-y-1 text-sm">
                    {!isForeign && isWithholdingConfigured && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400">
                        <span>{t('withholding')} ({invoiceWithholdingRate}%):</span>
                        <span className="font-mono">-{formatCurrency(invoiceWithholdingAmount, 'TND')}</span>
                      </div>
                    )}
                    {isForeign && isCurrencyConfigured && (
                      <div className="flex justify-between text-purple-600 dark:text-purple-400">
                        <span>1 {invoiceCurrency} =</span>
                        <span className="font-mono">{invoiceExchangeRate} TND</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t font-medium">
                      <span>{t('net_payable')}:</span>
                      <span className="font-mono text-primary">{formatCurrency(adjustedNetPayable, isForeign ? invoiceCurrency : 'TND')}</span>
                    </div>
                    {isForeign && isCurrencyConfigured && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>≈ {t('in_tnd')}:</span>
                        <span className="font-mono">{formatCurrency(adjustedNetPayable * invoiceExchangeRate, 'TND')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-green-600">
                      <span>{t('paid_amount')}:</span>
                      <span className="font-mono">{formatCurrency(paidAmount, isForeign ? invoiceCurrency : 'TND')}</span>
                    </div>
                    <div className="flex justify-between text-orange-600 font-medium">
                      <span>{t('remaining_balance')}:</span>
                      <span className="font-mono">{formatCurrency(remainingBalance, isForeign ? invoiceCurrency : 'TND')}</span>
                    </div>
                    {isForeign && isCurrencyConfigured && remainingBalance > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>≈ {t('in_tnd')}:</span>
                        <span className="font-mono">{formatCurrency(remainingBalanceInTND, 'TND')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('payment_progress')}</span>
                  <span>{adjustedNetPayable > 0 ? ((paidAmount / adjustedNetPayable) * 100).toFixed(0) : 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, adjustedNetPayable > 0 ? (paidAmount / adjustedNetPayable) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Two-Step Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="config" className="flex items-center gap-2">
                  {isForeign ? <Coins className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
                  <span className="hidden sm:inline">{t('step')} 1:</span> 
                  {isForeign ? t('currency_config') : t('withholding_config')}
                </TabsTrigger>
                <TabsTrigger value="payment" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('step')} 2:</span> {t('execute_payment')}
                </TabsTrigger>
              </TabsList>

              {/* Step 1: Configuration (Withholding for local, Currency for foreign) */}
              <TabsContent value="config" className="mt-4 space-y-4">
                {isForeign ? (
                  /* Foreign Client: Currency Configuration */
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{t('configure_currency')}</h3>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {t('currency_config_explanation')}
                    </p>

                    {/* Lock indicator if payments exist */}
                    {hasPayments && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('currency_locked')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('currency_locked_explanation')}
                        </p>
                      </div>
                    )}

                    {/* Current config status */}
                    {isCurrencyConfigured && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('currency_configured')}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">{t('currency')}:</span>
                            <span className="ml-2 font-medium">{invoiceCurrency}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t('rate')}:</span>
                            <span className="ml-2 font-mono font-medium">1 {invoiceCurrency} = {invoiceExchangeRate} TND</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Currency selector */}
                    <div className="space-y-2">
                      <Label className="text-sm">{t('payment_currency')}</Label>
                      <Select 
                        value={selectedCurrency} 
                        onValueChange={setSelectedCurrency}
                        disabled={!canModifyCurrency}
                      >
                        <SelectTrigger className={!canModifyCurrency ? 'opacity-60' : ''}>
                          <SelectValue placeholder={t('select_currency')} />
                        </SelectTrigger>
                        <SelectContent>
                          {FOREIGN_CURRENCIES.map((code) => {
                            const curr = CURRENCIES.find(c => c.code === code);
                            return (
                              <SelectItem key={code} value={code}>
                                {code} - {curr?.name || code} ({curr?.symbol || code})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Exchange rate input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{t('exchange_rate')}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => fetchExchangeRate(selectedCurrency)}
                          disabled={isLoadingExchangeRate}
                        >
                          {isLoadingExchangeRate ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          {t('refresh_rate')}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">1 {selectedCurrency} =</span>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          className="flex-1"
                          disabled={!canModifyCurrency && hasPayments}
                        />
                        <span className="text-sm font-medium">TND</span>
                      </div>
                    </div>

                    {/* Preview calculation */}
                    {selectedCurrency && parseFloat(exchangeRate) > 0 && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                        <div className="flex items-center gap-2 text-primary">
                          <Calculator className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('conversion_preview')}</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('invoice_amount')}:</span>
                            <span className="font-mono">{formatCurrency(invoice.subtotal_ht, selectedCurrency)}</span>
                          </div>
                          <div className="flex justify-between text-purple-600">
                            <span>× {t('exchange_rate')}:</span>
                            <span className="font-mono">{previewExchangeRate}</span>
                          </div>
                          <div className="flex justify-between border-t pt-1 font-medium text-primary">
                            <span>{t('equivalent_in_tnd')}:</span>
                            <span className="font-mono">{formatCurrency(previewAmountInTND, 'TND')}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Save config button */}
                    <Button 
                      onClick={handleSaveConfig} 
                      disabled={!canSaveCurrencyConfig || isSavingConfig}
                      className="w-full"
                    >
                      {isSavingConfig ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('saving')}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {isCurrencyConfigured ? t('update_currency_config') : t('save_currency_config')}
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  /* Local Client: Withholding Configuration */
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Percent className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{t('configure_withholding')}</h3>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {t('withholding_on_ht_explanation')}
                    </p>

                    {/* Lock indicator if payments exist */}
                    {hasPayments && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('withholding_locked')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('withholding_locked_explanation')}
                        </p>
                      </div>
                    )}

                    {/* Current withholding status */}
                    {isWithholdingConfigured && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('withholding_configured')}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">{t('rate')}:</span>
                            <span className="ml-2 font-medium">{invoiceWithholdingRate}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t('amount')}:</span>
                            <span className="ml-2 font-mono font-medium">{formatCurrency(invoiceWithholdingAmount, 'TND')}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Withholding rate selector */}
                    <div className="space-y-2">
                      <Label className="text-sm">{t('withholding_rate')}</Label>
                      <Select 
                        value={selectedWithholdingRate} 
                        onValueChange={setSelectedWithholdingRate}
                        disabled={!canModifyWithholding}
                      >
                        <SelectTrigger className={!canModifyWithholding ? 'opacity-60' : ''}>
                          <SelectValue placeholder={t('select_withholding_rate')} />
                        </SelectTrigger>
                        <SelectContent>
                          {withholdingRates.map((rate) => (
                            <SelectItem key={rate} value={String(rate)}>
                              {rate}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Preview calculation */}
                    {selectedWithholdingRate !== '' && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                        <div className="flex items-center gap-2 text-primary">
                          <Calculator className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('calculation_preview')}</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('subtotal_ht')}:</span>
                            <span className="font-mono">{formatCurrency(invoice.subtotal_ht, 'TND')}</span>
                          </div>
                          <div className="flex justify-between text-amber-600">
                            <span>- {t('withholding')} ({previewWithholdingRate}%):</span>
                            <span className="font-mono">{formatCurrency(previewWithholdingAmount, 'TND')}</span>
                          </div>
                          <div className="flex justify-between border-t pt-1">
                            <span className="text-muted-foreground">{t('adjusted_ht')}:</span>
                            <span className="font-mono">{formatCurrency(previewAdjustedHT, 'TND')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">+ {t('total_vat')}:</span>
                            <span className="font-mono">{formatCurrency(invoice.total_vat, 'TND')}</span>
                          </div>
                          {invoice.stamp_duty_enabled && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">+ {t('stamp_duty')}:</span>
                              <span className="font-mono">{formatCurrency(invoice.stamp_duty_amount, 'TND')}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t pt-1 font-medium text-primary">
                            <span>{t('new_net_payable')}:</span>
                            <span className="font-mono">{formatCurrency(previewNetPayable, 'TND')}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Save withholding button */}
                    <Button 
                      onClick={handleSaveConfig} 
                      disabled={!canSaveWithholding || isSavingConfig}
                      className="w-full"
                    >
                      {isSavingConfig ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('saving')}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {isWithholdingConfigured ? t('update_withholding') : t('save_withholding')}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Step 2: Execute Payment */}
              <TabsContent value="payment" className="mt-4 space-y-4">
                {/* Client Credit Cards - Separated by source */}
                {clientBalance > 0 && remainingBalance > 0 && (
                  <div className="space-y-3">
                    {/* Credit Notes (Avoirs) Card */}
                    {creditNoteBalance > 0 && (
                      <div className="rounded-xl border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-blue-500/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t('credit_from_avoirs')}</p>
                              <p className="text-xl font-bold text-blue-600">{formatCurrency(creditNoteBalance, 'TND')}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">
                            <FileText className="h-3 w-3 mr-1" />
                            {t('credit_note')}
                          </Badge>
                        </div>
                        
                        {/* Quick apply button */}
                        <div className="flex items-center gap-2 pt-2 border-t border-blue-500/20">
                          <div className="flex-1 text-sm">
                            <span className="text-muted-foreground">{t('max_applicable')}: </span>
                            <span className="font-mono font-semibold text-blue-600">
                              {formatCurrency(Math.min(creditNoteBalance, isForeign ? remainingBalanceInTND : remainingBalance), 'TND')}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                              setPaymentMethod('client_credit_note');
                              if (isForeign) {
                                const maxInCurrency = Math.min(creditNoteBalance / parsedPaymentExchangeRate, remainingBalance);
                                setAmount(maxInCurrency.toFixed(3));
                              } else {
                                setAmount(Math.min(creditNoteBalance, remainingBalance).toFixed(3));
                              }
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            {t('apply_credit_note')}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Deposits Card */}
                    {depositBalance > 0 && (
                      <div className="rounded-xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-emerald-500/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                              <PiggyBank className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t('credit_from_deposits')}</p>
                              <p className="text-xl font-bold text-emerald-600">{formatCurrency(depositBalance, 'TND')}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                            <PiggyBank className="h-3 w-3 mr-1" />
                            {t('direct_deposit')}
                          </Badge>
                        </div>
                        
                        {/* Quick apply button */}
                        <div className="flex items-center gap-2 pt-2 border-t border-emerald-500/20">
                          <div className="flex-1 text-sm">
                            <span className="text-muted-foreground">{t('max_applicable')}: </span>
                            <span className="font-mono font-semibold text-emerald-600">
                              {formatCurrency(Math.min(depositBalance, isForeign ? remainingBalanceInTND : remainingBalance), 'TND')}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => {
                              setPaymentMethod('client_deposit');
                              if (isForeign) {
                                const maxInCurrency = Math.min(depositBalance / parsedPaymentExchangeRate, remainingBalance);
                                setAmount(maxInCurrency.toFixed(3));
                              } else {
                                setAmount(Math.min(depositBalance, remainingBalance).toFixed(3));
                              }
                            }}
                          >
                            <PiggyBank className="h-4 w-4 mr-1" />
                            {t('apply_deposit')}
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground italic">
                      {t('credit_will_be_debited')}
                    </p>
                  </div>
                )}

                {/* New Payment Form */}
                {remainingBalance > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{t('new_payment')}</h3>
                    </div>

                    {/* Foreign client: Exchange rate for this payment */}
                    {isForeign && (
                      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                              {t('payment_exchange_rate')}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => fetchExchangeRate(invoiceCurrency).then(() => setPaymentExchangeRate(exchangeRate))}
                          >
                            <RefreshCw className="h-3 w-3" />
                            {t('refresh')}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">1 {invoiceCurrency} =</span>
                          <Input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            value={paymentExchangeRate}
                            onChange={(e) => setPaymentExchangeRate(e.target.value)}
                            className="w-32 h-8 text-sm"
                          />
                          <span className="text-sm">TND</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('payment_exchange_rate_note')}
                        </p>
                      </div>
                    )}

                    {/* Row 1: Date + Amount */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t('payment_date')} *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              {format(paymentDate, 'dd/MM/yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-[100]" align="start">
                            <Calendar
                              mode="single"
                              selected={paymentDate}
                              onSelect={(date) => date && setPaymentDate(date)}
                              initialFocus
                              locale={getDateLocale()}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {t('amount')} {isForeign ? `(${invoiceCurrency})` : ''} *
                        </Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          max={remainingBalance}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Show TND equivalent for foreign */}
                    {isForeign && parsedAmount > 0 && (
                      <div className="flex justify-between text-sm p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground">{t('equivalent_in_tnd')}:</span>
                        <span className="font-mono font-medium">{formatCurrency(amountInTND, 'TND')}</span>
                      </div>
                    )}

                    {/* Quick amount buttons */}
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => setAmount(remainingBalance.toFixed(3))}
                      >
                        100% - {formatCurrency(remainingBalance, isForeign ? invoiceCurrency : 'TND')}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => setAmount((remainingBalance / 2).toFixed(3))}
                      >
                        50% - {formatCurrency(remainingBalance / 2, isForeign ? invoiceCurrency : 'TND')}
                      </Button>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('payment_method')} *</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder={t('select_payment_method')} />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          {PAYMENT_METHODS.map((method) => {
                            const Icon = method.icon;
                            return (
                              <SelectItem key={method.value} value={method.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{getPaymentMethodLabel(method.value)}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Client Credit Note Payment Info */}
                    {isClientCreditNotePayment && (
                      <div className="p-4 rounded-lg bg-blue-500/10 border-2 border-blue-500/30 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-blue-700 dark:text-blue-400">{t('payment_from_credit_note')}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('credit_will_be_debited')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-2 rounded bg-muted/50">
                            <span className="text-muted-foreground text-xs">{t('credit_from_avoirs')}:</span>
                            <p className="font-mono font-semibold text-blue-600">{formatCurrency(creditNoteBalance, 'TND')}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <span className="text-muted-foreground text-xs">{t('to_debit')}:</span>
                            <p className="font-mono font-semibold text-primary">{formatCurrency(amountInTND, 'TND')}</p>
                          </div>
                        </div>
                        
                        {amountInTND > creditNoteBalance && (
                          <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/30">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <p className="text-xs text-destructive font-medium">
                              {t('insufficient_credit_note_balance')}
                            </p>
                          </div>
                        )}
                        
                        {/* Quick amount buttons for credit note */}
                        <div className="flex gap-2 pt-2 border-t border-blue-500/20">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            className="flex-1 h-7 text-xs border-blue-500/30 text-blue-700 hover:bg-blue-500/10"
                            onClick={() => {
                              if (isForeign) {
                                const maxInCurrency = Math.min(creditNoteBalance / parsedPaymentExchangeRate, remainingBalance);
                                setAmount(maxInCurrency.toFixed(3));
                              } else {
                                setAmount(Math.min(creditNoteBalance, remainingBalance).toFixed(3));
                              }
                            }}
                          >
                            {t('apply_full_credit')} ({formatCurrency(Math.min(creditNoteBalance, isForeign ? remainingBalanceInTND : remainingBalance), 'TND')})
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Client Deposit Payment Info */}
                    {isClientDepositPayment && (
                      <div className="p-4 rounded-lg bg-emerald-500/10 border-2 border-emerald-500/30 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <PiggyBank className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-emerald-700 dark:text-emerald-400">{t('payment_from_deposit')}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('credit_will_be_debited')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-2 rounded bg-muted/50">
                            <span className="text-muted-foreground text-xs">{t('credit_from_deposits')}:</span>
                            <p className="font-mono font-semibold text-emerald-600">{formatCurrency(depositBalance, 'TND')}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <span className="text-muted-foreground text-xs">{t('to_debit')}:</span>
                            <p className="font-mono font-semibold text-primary">{formatCurrency(amountInTND, 'TND')}</p>
                          </div>
                        </div>
                        
                        {amountInTND > depositBalance && (
                          <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/30">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <p className="text-xs text-destructive font-medium">
                              {t('insufficient_deposit_balance')}
                            </p>
                          </div>
                        )}
                        
                        {/* Quick amount buttons for deposit */}
                        <div className="flex gap-2 pt-2 border-t border-emerald-500/20">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            className="flex-1 h-7 text-xs border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                            onClick={() => {
                              if (isForeign) {
                                const maxInCurrency = Math.min(depositBalance / parsedPaymentExchangeRate, remainingBalance);
                                setAmount(maxInCurrency.toFixed(3));
                              } else {
                                setAmount(Math.min(depositBalance, remainingBalance).toFixed(3));
                              }
                            }}
                          >
                            {t('apply_full_credit')} ({formatCurrency(Math.min(depositBalance, isForeign ? remainingBalanceInTND : remainingBalance), 'TND')})
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Reference Number (for non-mixed methods that require it) */}
                    {!isMixedPayment && requiresReference && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t('reference_number')} *</Label>
                        <Input
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          placeholder={t('enter_reference_number')}
                          className="h-9 text-sm"
                        />
                      </div>
                    )}

                    {/* Mixed Payment Lines */}
                    {isMixedPayment && (
                      <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">{t('mixed_payment_details')}</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addMixedLine}
                            className="h-7 text-xs gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            {t('add_payment_line')}
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {isForeign ? t('mixed_amounts_in_tnd') : ''}
                        </p>

                        <div className="space-y-3">
                          {mixedLines.map((line, index) => {
                            const method = MIXED_PAYMENT_METHODS.find(m => m.value === line.method);
                            const needsRef = method?.requiresReference || false;
                            
                            return (
                              <div key={line.id} className="space-y-2 p-3 rounded-lg border bg-background">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {t('payment_line')} #{index + 1}
                                  </span>
                                  {mixedLines.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:text-destructive"
                                      onClick={() => removeMixedLine(line.id)}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">{t('payment_method')} *</Label>
                                    <Select 
                                      value={line.method} 
                                      onValueChange={(v) => updateMixedLine(line.id, 'method', v)}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder={t('select_payment_method')} />
                                      </SelectTrigger>
                                      <SelectContent className="z-[100]">
                                        {MIXED_PAYMENT_METHODS.map((m) => {
                                          const Icon = m.icon;
                                          return (
                                            <SelectItem key={m.value} value={m.value}>
                                              <div className="flex items-center gap-2">
                                                <Icon className="h-3.5 w-3.5" />
                                                <span>{getPaymentMethodLabel(m.value)}</span>
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs">{t('amount')} (TND) *</Label>
                                    <Input
                                      type="number"
                                      step="0.001"
                                      min="0.001"
                                      value={line.amount}
                                      onChange={(e) => updateMixedLine(line.id, 'amount', e.target.value)}
                                      className="h-8 text-xs"
                                      placeholder="0.000"
                                    />
                                  </div>
                                </div>

                                {needsRef && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">{t('reference_number')} *</Label>
                                    <Input
                                      value={line.referenceNumber}
                                      onChange={(e) => updateMixedLine(line.id, 'referenceNumber', e.target.value)}
                                      placeholder={t('enter_reference_number')}
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Mixed total validation */}
                        <div className={`p-3 rounded-lg border ${isMixedAmountValid ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'}`}>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {!isMixedAmountValid && <AlertCircle className="h-4 w-4 text-destructive" />}
                              <span>{t('mixed_total')}</span>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold ${isMixedAmountValid ? 'text-green-600' : 'text-destructive'}`}>
                                {formatCurrency(mixedLinesTotal, 'TND')}
                              </span>
                              <span className="text-muted-foreground"> / {formatCurrency(isForeign ? amountInTND : parsedAmount, 'TND')}</span>
                            </div>
                          </div>
                          {!isMixedAmountValid && parsedAmount > 0 && (
                            <p className="text-xs text-destructive mt-1">
                              {mixedAmountDifference > 0 
                                ? `${t('mixed_remaining')}: ${formatCurrency(mixedAmountDifference, 'TND')}`
                                : `${t('mixed_excess')}: ${formatCurrency(Math.abs(mixedAmountDifference), 'TND')}`
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('notes')}</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('payment_notes_placeholder')}
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>

                    {/* Save Button */}
                    <Button 
                      onClick={handleSavePayment} 
                      disabled={!canSavePayment || isSaving}
                      className="w-full"
                      size="lg"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('saving')}
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          {t('record_payment')}
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <p className="text-green-700 dark:text-green-400 font-medium">
                      {t('invoice_fully_paid')}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Separator />

            {/* Payment History */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">{t('payment_history')}</h3>
              
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('no_payments_yet')}
                </p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div 
                      key={payment.id} 
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getPaymentMethodIcon(payment.payment_method)}
                            <span className="font-medium text-sm">
                              {getPaymentMethodLabel(payment.payment_method)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(payment.payment_date), 'dd/MM/yyyy')}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {isForeign ? (
                              <>
                                <p>{t('amount')}: {formatCurrency(payment.amount, invoiceCurrency)}</p>
                                <p>{t('equivalent_in_tnd')}: {formatCurrency(payment.net_amount, 'TND')}</p>
                              </>
                            ) : (
                              <p>{t('amount')}: {formatCurrency(payment.amount, 'TND')}</p>
                            )}
                            {payment.reference_number && (
                              <p className="break-all">{t('reference')}: {payment.reference_number}</p>
                            )}
                            {payment.notes && (
                              <p className="italic truncate">{payment.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-primary text-sm">
                            {formatCurrency(payment.amount, isForeign ? invoiceCurrency : 'TND')}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeletePayment(payment)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
