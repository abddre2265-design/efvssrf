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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Lock,
  Settings2,
  Percent,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Coins,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/invoices/types';

interface PurchaseDocument {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  supplier_id: string | null;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
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

interface PurchasePayment {
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

interface PurchasePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: PurchaseDocument | null;
  onPaymentComplete: () => void;
}

const WITHHOLDING_RATES = [0, 0.5, 1, 1.5, 2, 3, 5, 10, 15, 20, 25];

// Available currencies for foreign payments
const FOREIGN_CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'AED', 'SAR', 'QAR', 'MAD', 'TRY', 'CNY'];

const PAYMENT_METHODS = [
  { value: 'cash', icon: Banknote, requiresReference: false, label: 'Espèces' },
  { value: 'card', icon: CreditCard, requiresReference: false, label: 'Carte' },
  { value: 'check', icon: Receipt, requiresReference: true, label: 'Chèque' },
  { value: 'draft', icon: FileText, requiresReference: true, label: 'Traite' },
  { value: 'iban_transfer', icon: Building2, requiresReference: true, label: 'Virement IBAN' },
  { value: 'swift_transfer', icon: Globe, requiresReference: true, label: 'Virement SWIFT' },
  { value: 'bank_deposit', icon: Wallet, requiresReference: true, label: 'Dépôt bancaire' },
  { value: 'mixed', icon: Layers, requiresReference: false, label: 'Mixte' },
];

const MIXED_PAYMENT_METHODS = PAYMENT_METHODS.filter(m => m.value !== 'mixed');

interface MixedPaymentLine {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string;
}

export const PurchasePaymentDialog: React.FC<PurchasePaymentDialogProps> = ({
  open,
  onOpenChange,
  document,
  onPaymentComplete,
}) => {
  const { language, isRTL } = useLanguage();
  
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<string>('config');
  
  // Withholding configuration state (Step 1 for local suppliers)
  const [selectedWithholdingRate, setSelectedWithholdingRate] = useState<string>('');
  
  // Currency/Exchange rate configuration state (Step 1 for foreign suppliers)
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

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const generateLineId = () => Math.random().toString(36).substring(2, 9);

  // Determine if supplier is foreign
  const isForeign = document?.supplier?.supplier_type === 'foreign';

  // Withholding status from document (only for local)
  const isWithholdingConfigured = !isForeign && (document?.withholding_applied || false);
  const documentWithholdingRate = document?.withholding_rate || 0;
  const documentWithholdingAmount = document?.withholding_amount || 0;

  // Currency configuration status (for foreign)
  const isCurrencyConfigured = isForeign && document?.exchange_rate && document.exchange_rate > 0;
  const documentCurrency = document?.currency || 'EUR';
  const documentExchangeRate = document?.exchange_rate || 1;

  // Calculate the adjusted net payable - withholding applied on TTC
  const calculateAdjustedNetPayable = (doc: PurchaseDocument | null): number => {
    if (!doc) return 0;
    
    // For foreign suppliers: just the subtotal HT (no VAT, no stamp duty, no withholding)
    if (isForeign) {
      return doc.subtotal_ht;
    }
    
    // For local suppliers: Apply withholding on TTC
    const withholdingOnTTC = doc.withholding_applied 
      ? doc.total_ttc * (doc.withholding_rate / 100)
      : 0;
    
    // TTC + Timbre - Retenue
    return doc.total_ttc + doc.stamp_duty_amount - withholdingOnTTC;
  };

  const adjustedNetPayable = calculateAdjustedNetPayable(document);
  const paidAmount = document?.paid_amount || 0;
  const remainingBalance = Math.max(0, adjustedNetPayable - paidAmount);
  
  // Convert amounts for foreign suppliers
  const remainingBalanceInTND = isForeign ? remainingBalance * documentExchangeRate : remainingBalance;
  
  // Check if payments exist (blocks config modification)
  const hasPayments = payments.length > 0;

  // Fetch exchange rate for a currency
  const fetchExchangeRate = async (currency: string) => {
    if (currency === 'TND') {
      setExchangeRate('1');
      return;
    }
    
    setIsLoadingExchangeRate(true);
    try {
      // Try to get from exchange_rates table first
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

  // Load payments and set initial states when dialog opens
  useEffect(() => {
    if (open && document) {
      loadPayments();
      
      if (isForeign) {
        // For foreign suppliers: set currency and exchange rate from document
        setSelectedCurrency(document.currency || 'EUR');
        setExchangeRate((document.exchange_rate || 1).toString());
        setPaymentExchangeRate((document.exchange_rate || 1).toString());
      } else {
        // For local suppliers: set withholding rate
        setSelectedWithholdingRate(document.withholding_applied ? String(document.withholding_rate) : '');
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
        setActiveTab(document.withholding_applied ? 'payment' : 'config');
      }
    }
  }, [open, document]);

  // Update amount when remaining balance changes
  useEffect(() => {
    if (document && open) {
      setAmount(remainingBalance > 0 ? remainingBalance.toFixed(3) : '0');
    }
  }, [remainingBalance, open]);

  // Fetch exchange rate when currency changes (for foreign)
  useEffect(() => {
    if (isForeign && selectedCurrency && open && !isCurrencyConfigured) {
      fetchExchangeRate(selectedCurrency);
    }
  }, [selectedCurrency, isForeign, open]);

  // When switching to mixed mode, initialize with one empty line
  useEffect(() => {
    if (paymentMethod === 'mixed' && mixedLines.length === 0) {
      setMixedLines([{ id: generateLineId(), method: '', amount: '', referenceNumber: '' }]);
    } else if (paymentMethod !== 'mixed') {
      setMixedLines([]);
    }
  }, [paymentMethod]);

  const loadPayments = async () => {
    if (!document) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_payments')
        .select('*')
        .eq('purchase_document_id', document.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Erreur lors du chargement des paiements');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedMethod = PAYMENT_METHODS.find(m => m.value === paymentMethod);
  const requiresReference = selectedMethod?.requiresReference || false;
  const isMixedPayment = paymentMethod === 'mixed';

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

  const canSavePayment = isMixedPayment
    ? (mixedLines.length > 0 && areMixedLinesValid && isMixedAmountValid && parsedAmount > 0 && parsedAmount <= remainingBalance && paymentDate)
    : (paymentMethod && parsedAmount > 0 && parsedAmount <= remainingBalance && (!requiresReference || referenceNumber.trim()) && paymentDate);

  // Can save withholding: rate must be selected and no payments exist (local only)
  const canSaveWithholding = !isForeign && selectedWithholdingRate !== '' && !hasPayments;
  
  // Can save currency config: currency and rate must be set (foreign only)
  const canSaveCurrencyConfig = isForeign && selectedCurrency && parseFloat(exchangeRate) > 0;
  
  // Can modify config: no payments exist
  const canModifyConfig = !hasPayments;

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
      const label = method?.label || line.method;
      const amt = formatCurrency(parseFloat(line.amount) || 0, 'TND');
      if (method?.requiresReference && line.referenceNumber) {
        return `${label}: ${amt} (${line.referenceNumber})`;
      }
      return `${label}: ${amt}`;
    }).join(' | ');
  };

  // Save configuration (withholding for local, currency for foreign)
  const handleSaveConfig = async () => {
    if (!document) return;

    setIsSavingConfig(true);
    try {
      if (isForeign) {
        // Save currency and exchange rate for foreign supplier
        const rate = parseFloat(exchangeRate) || 1;
        
        const { error } = await supabase
          .from('purchase_documents')
          .update({
            currency: selectedCurrency,
            exchange_rate: rate,
            net_payable: document.subtotal_ht, // For foreign, net_payable = subtotal_ht
          })
          .eq('id', document.id);

        if (error) throw error;
        
        // Update payment exchange rate to match
        setPaymentExchangeRate(rate.toString());
        
        toast.success('Configuration de la devise enregistrée');
      } else {
        // Save withholding for local supplier
        if (!canSaveWithholding) return;
        
        const rate = parseFloat(selectedWithholdingRate) || 0;
        // Withholding is calculated on TTC
        const withholdingAmount = document.total_ttc * (rate / 100);
        
        // Calculate new net_payable: TTC + Timbre - Retenue
        const newNetPayable = document.total_ttc + document.stamp_duty_amount - withholdingAmount;

        const { error } = await supabase
          .from('purchase_documents')
          .update({
            withholding_rate: rate,
            withholding_amount: withholdingAmount,
            withholding_applied: true,
            net_payable: newNetPayable,
          })
          .eq('id', document.id);

        if (error) throw error;

        toast.success('Configuration de la retenue enregistrée');
      }
      
      // Switch to payment tab
      setActiveTab('payment');
      
      // Reload to get updated data
      onPaymentComplete();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erreur lors de l\'enregistrement de la configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle payment save
  const handleSavePayment = async () => {
    if (!document || !canSavePayment) return;

    setIsSaving(true);
    try {
      const finalReference = isMixedPayment ? buildMixedReference() : (referenceNumber || null);

      // For foreign suppliers, include exchange rate in notes
      let finalNotes = notes.trim() || null;
      if (isForeign) {
        const rateNote = `Taux de change: 1 ${documentCurrency} = ${parsedPaymentExchangeRate} TND`;
        finalNotes = finalNotes ? `${finalNotes}\n${rateNote}` : rateNote;
      }

      // Create payment record
      // For foreign: amount is in foreign currency, net_amount is in TND
      const { error: paymentError } = await supabase
        .from('purchase_payments')
        .insert({
          purchase_document_id: document.id,
          payment_date: format(paymentDate, 'yyyy-MM-dd'),
          amount: parsedAmount, // Amount in document currency
          withholding_rate: 0,
          withholding_amount: 0,
          net_amount: isForeign ? amountInTND : parsedAmount, // For foreign: TND equivalent
          payment_method: paymentMethod,
          reference_number: finalReference,
          notes: finalNotes,
        });

      if (paymentError) throw paymentError;

      // Update document paid amount and status
      const newPaidAmount = paidAmount + parsedAmount;
      const newPaymentStatus = newPaidAmount >= adjustedNetPayable ? 'paid' : 'partial';

      const { error: docError } = await supabase
        .from('purchase_documents')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus,
        })
        .eq('id', document.id);

      if (docError) throw docError;

      toast.success('Paiement enregistré avec succès');

      // Reset form
      setPaymentMethod('');
      setReferenceNumber('');
      setNotes('');
      setMixedLines([]);

      // Reload payments
      await loadPayments();

      // If fully paid, close dialog
      if (newPaymentStatus === 'paid') {
        onPaymentComplete();
      } else {
        // Update amount to new remaining balance
        const newRemaining = adjustedNetPayable - newPaidAmount;
        setAmount(newRemaining.toFixed(3));
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error('Erreur lors de l\'enregistrement du paiement');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete payment
  const handleDeletePayment = async (payment: PurchasePayment) => {
    if (!document) return;

    try {
      const { error: deleteError } = await supabase
        .from('purchase_payments')
        .delete()
        .eq('id', payment.id);

      if (deleteError) throw deleteError;

      // Update document
      const newPaidAmount = Math.max(0, paidAmount - payment.amount);
      const newPaymentStatus = newPaidAmount <= 0 ? 'unpaid' : newPaidAmount >= adjustedNetPayable ? 'paid' : 'partial';

      const { error: docError } = await supabase
        .from('purchase_documents')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus,
        })
        .eq('id', document.id);

      if (docError) throw docError;

      toast.success('Paiement supprimé');
      await loadPayments();
      
      // Update remaining
      const newRemaining = adjustedNetPayable - newPaidAmount;
      setAmount(newRemaining.toFixed(3));
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getSupplierName = () => {
    const supplier = document?.supplier;
    if (!supplier) return 'N/A';
    if (supplier.supplier_type === 'business_local') {
      return supplier.company_name || 'N/A';
    }
    return [supplier.first_name, supplier.last_name].filter(Boolean).join(' ') || supplier.company_name || 'N/A';
  };

  const isConfigured = isForeign ? isCurrencyConfigured : isWithholdingConfigured;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Paiement de facture d'achat
            {isForeign && (
              <Badge variant="secondary" className="ml-2">
                <Globe className="h-3 w-3 mr-1" />
                Étranger
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {document?.invoice_number || 'Facture'} - {getSupplierName()}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          {/* Document Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span>{formatCurrency(document?.subtotal_ht || 0, isForeign ? documentCurrency : 'TND')}</span>
            </div>
            {!isForeign && isWithholdingConfigured && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Retenue à la source ({documentWithholdingRate}%)</span>
                <span>-{formatCurrency(documentWithholdingAmount, 'TND')}</span>
              </div>
            )}
            {!isForeign && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA</span>
                  <span>{formatCurrency(document?.total_vat || 0, 'TND')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Timbre fiscal</span>
                  <span>{formatCurrency(document?.stamp_duty_amount || 0, 'TND')}</span>
                </div>
              </>
            )}
            {isForeign && isCurrencyConfigured && (
              <div className="flex justify-between text-sm text-blue-600">
                <span>Taux de change</span>
                <span>1 {documentCurrency} = {documentExchangeRate.toFixed(3)} TND</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Net à payer</span>
              <span>{formatCurrency(adjustedNetPayable, isForeign ? documentCurrency : 'TND')}</span>
            </div>
            {isForeign && isCurrencyConfigured && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Équivalent TND</span>
                <span>{formatCurrency(adjustedNetPayable * documentExchangeRate, 'TND')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Déjà payé</span>
              <span className="text-green-600">{formatCurrency(paidAmount, isForeign ? documentCurrency : 'TND')}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Restant à payer</span>
              <span className={cn(
                remainingBalance > 0 ? 'text-orange-600' : 'text-green-600'
              )}>
                {formatCurrency(remainingBalance, isForeign ? documentCurrency : 'TND')}
              </span>
            </div>
            {isForeign && isCurrencyConfigured && remainingBalance > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Équivalent TND</span>
                <span>{formatCurrency(remainingBalanceInTND, 'TND')}</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="config" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Configuration
                {isConfigured && hasPayments && <Lock className="h-3 w-3 text-muted-foreground" />}
              </TabsTrigger>
              <TabsTrigger value="payment" className="gap-2">
                <Coins className="h-4 w-4" />
                Paiements
                {payments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {payments.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Configuration Tab */}
            <TabsContent value="config" className="space-y-4 mt-4">
              <div className="p-4 border rounded-lg space-y-4">
                {isForeign ? (
                  // Foreign supplier: Currency configuration
                  <>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Configuration de la devise</h3>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Définissez la devise et le taux de change pour ce fournisseur étranger.
                      La devise est verrouillée après le premier paiement, mais le taux de change peut être ajusté.
                    </p>

                    {hasPayments && (
                      <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-sm text-amber-700">
                        <Lock className="h-4 w-4 flex-shrink-0" />
                        <span>Devise verrouillée (paiements existants). Le taux de change peut encore être modifié par paiement.</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Devise</label>
                      <Select 
                        value={selectedCurrency} 
                        onValueChange={setSelectedCurrency}
                        disabled={hasPayments}
                      >
                        <SelectTrigger className={cn(hasPayments && 'opacity-50')}>
                          <SelectValue placeholder="Sélectionner la devise..." />
                        </SelectTrigger>
                        <SelectContent>
                          {FOREIGN_CURRENCIES.map(curr => (
                            <SelectItem key={curr} value={curr}>
                              {curr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Taux de change (1 {selectedCurrency} = ? TND)</label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => fetchExchangeRate(selectedCurrency)}
                          disabled={isLoadingExchangeRate}
                        >
                          <RefreshCw className={cn("h-4 w-4", isLoadingExchangeRate && "animate-spin")} />
                        </Button>
                      </div>
                      <Input
                        type="number"
                        step="0.001"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        placeholder="3.400"
                      />
                    </div>

                    {/* Preview of calculation */}
                    {parseFloat(exchangeRate) > 0 && (
                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Conversion
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Montant en {selectedCurrency}</span>
                            <span>{formatCurrency(document?.subtotal_ht || 0, selectedCurrency)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Taux de change</span>
                            <span>× {parseFloat(exchangeRate).toFixed(3)}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-semibold">
                            <span>Équivalent TND</span>
                            <span className="text-primary">
                              {formatCurrency((document?.subtotal_ht || 0) * parseFloat(exchangeRate), 'TND')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Local supplier: Withholding configuration
                  <>
                    <div className="flex items-center gap-2">
                      <Percent className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Retenue à la source</h3>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      La retenue à la source est calculée sur le sous-total HT de la facture.
                      Cette configuration est verrouillée une fois le premier paiement enregistré.
                    </p>

                    {hasPayments && (
                      <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-sm text-amber-700">
                        <Lock className="h-4 w-4 flex-shrink-0" />
                        <span>Configuration verrouillée (paiements existants)</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Taux de retenue</label>
                      <Select 
                        value={selectedWithholdingRate} 
                        onValueChange={setSelectedWithholdingRate}
                        disabled={!canModifyConfig}
                      >
                        <SelectTrigger className={cn(!canModifyConfig && 'opacity-50')}>
                          <SelectValue placeholder="Sélectionner le taux..." />
                        </SelectTrigger>
                        <SelectContent>
                          {WITHHOLDING_RATES.map(rate => (
                            <SelectItem key={rate} value={String(rate)}>
                              <div className="flex items-center justify-between w-full gap-4">
                                <span>{rate}%</span>
                                <span className="text-muted-foreground">
                                  {formatCurrency((document?.subtotal_ht || 0) * (rate / 100), 'TND')}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Preview of calculation */}
                    {selectedWithholdingRate !== '' && (
                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Simulation du calcul
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Sous-total HT</span>
                            <span>{formatCurrency(document?.subtotal_ht || 0, 'TND')}</span>
                          </div>
                          <div className="flex justify-between text-orange-600">
                            <span>Retenue ({selectedWithholdingRate}%)</span>
                            <span>-{formatCurrency((document?.subtotal_ht || 0) * (parseFloat(selectedWithholdingRate) / 100), 'TND')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">HT après retenue</span>
                            <span>{formatCurrency((document?.subtotal_ht || 0) * (1 - parseFloat(selectedWithholdingRate) / 100), 'TND')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">+ TVA</span>
                            <span>{formatCurrency(document?.total_vat || 0, 'TND')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">+ Timbre</span>
                            <span>{formatCurrency(document?.stamp_duty_amount || 0, 'TND')}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-semibold">
                            <span>Net à payer</span>
                            <span className="text-primary">
                              {formatCurrency(
                                (document?.subtotal_ht || 0) * (1 - parseFloat(selectedWithholdingRate) / 100) +
                                (document?.total_vat || 0) +
                                (document?.stamp_duty_amount || 0),
                                'TND'
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Save button */}
                {canModifyConfig && (
                  <Button
                    onClick={handleSaveConfig}
                    disabled={isForeign ? !canSaveCurrencyConfig : !canSaveWithholding || isSavingConfig}
                    className="w-full"
                  >
                    {isSavingConfig ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirmer la configuration
                      </>
                    )}
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payment" className="space-y-4 mt-4">
              {/* Warning if not configured */}
              {!isConfigured && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {isForeign 
                      ? "Veuillez d'abord configurer la devise dans l'onglet Configuration."
                      : "Veuillez d'abord configurer la retenue à la source dans l'onglet Configuration."}
                  </span>
                </div>
              )}

              {/* Payment History */}
              {payments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Paiements enregistrés</h4>
                  <div className="space-y-2">
                    {payments.map((payment) => {
                      const Icon = PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.icon || CreditCard;
                      const methodLabel = PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label || payment.payment_method;
                      return (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                {formatCurrency(payment.amount, isForeign ? documentCurrency : 'TND')}
                                {isForeign && (
                                  <span className="text-muted-foreground ml-2">
                                    ({formatCurrency(payment.net_amount, 'TND')})
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: getDateLocale() })} - {methodLabel}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePayment(payment)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* New Payment Form */}
              {remainingBalance > 0 && isConfigured && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <h4 className="font-semibold">Nouveau paiement</h4>

                  {/* Payment Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date de paiement</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(paymentDate, 'dd MMMM yyyy', { locale: getDateLocale() })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={paymentDate}
                          onSelect={(d) => d && setPaymentDate(d)}
                          locale={getDateLocale()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Montant ({isForeign ? documentCurrency : 'TND'})
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.000"
                    />
                    {parsedAmount > remainingBalance && (
                      <p className="text-xs text-destructive">
                        Le montant dépasse le restant à payer
                      </p>
                    )}
                  </div>

                  {/* Exchange rate per payment for foreign */}
                  {isForeign && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Taux de change pour ce paiement</label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            fetchExchangeRate(documentCurrency);
                            setPaymentExchangeRate(exchangeRate);
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        type="number"
                        step="0.001"
                        value={paymentExchangeRate}
                        onChange={(e) => setPaymentExchangeRate(e.target.value)}
                        placeholder="3.400"
                      />
                      <div className="p-2 bg-blue-500/10 rounded text-sm text-blue-700">
                        <div className="flex justify-between">
                          <span>Équivalent TND</span>
                          <span className="font-medium">{formatCurrency(amountInTND, 'TND')}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mode de paiement</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => {
                          const Icon = m.icon;
                          return (
                            <SelectItem key={m.value} value={m.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {m.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reference Number for applicable methods */}
                  {paymentMethod && requiresReference && !isMixedPayment && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Numéro de référence *</label>
                      <Input
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="N° chèque, virement, etc."
                      />
                    </div>
                  )}

                  {/* Mixed Payment Lines */}
                  {isMixedPayment && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Détail du paiement mixte</label>
                        <Button variant="outline" size="sm" onClick={addMixedLine}>
                          + Ajouter
                        </Button>
                      </div>
                      
                      {mixedLines.map((line, index) => {
                        const lineMethod = MIXED_PAYMENT_METHODS.find(m => m.value === line.method);
                        return (
                          <div key={line.id} className="p-3 border rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Ligne {index + 1}</span>
                              {mixedLines.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => removeMixedLine(line.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={line.method}
                                onValueChange={(v) => updateMixedLine(line.id, 'method', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Méthode" />
                                </SelectTrigger>
                                <SelectContent>
                                  {MIXED_PAYMENT_METHODS.map(m => (
                                    <SelectItem key={m.value} value={m.value}>
                                      <div className="flex items-center gap-2">
                                        <m.icon className="h-4 w-4" />
                                        {m.label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                step="0.001"
                                value={line.amount}
                                onChange={(e) => updateMixedLine(line.id, 'amount', e.target.value)}
                                placeholder="Montant"
                              />
                            </div>
                            {lineMethod?.requiresReference && (
                              <Input
                                value={line.referenceNumber}
                                onChange={(e) => updateMixedLine(line.id, 'referenceNumber', e.target.value)}
                                placeholder="Référence (obligatoire)"
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* Mixed total validation */}
                      <div className={cn(
                        "p-2 rounded-lg text-sm",
                        isMixedAmountValid ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"
                      )}>
                        <div className="flex justify-between">
                          <span>Total des lignes:</span>
                          <span className="font-medium">{formatCurrency(mixedLinesTotal, 'TND')}</span>
                        </div>
                        {!isMixedAmountValid && (
                          <p className="text-xs mt-1">
                            Différence: {formatCurrency(Math.abs(mixedAmountDifference), 'TND')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes (optionnel)</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notes additionnelles..."
                      rows={2}
                    />
                  </div>

                  {/* Save Button */}
                  <Button
                    onClick={handleSavePayment}
                    disabled={!canSavePayment || isSaving}
                    className="w-full"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Enregistrer le paiement
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Fully Paid Message */}
              {remainingBalance <= 0 && (
                <div className="flex flex-col items-center gap-2 p-6 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <h4 className="font-semibold text-green-700">Facture entièrement payée</h4>
                  <p className="text-sm text-muted-foreground">
                    Tous les paiements ont été enregistrés.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default PurchasePaymentDialog;
