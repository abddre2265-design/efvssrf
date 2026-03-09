import React, { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Receipt, 
  CreditCard,
  CalendarIcon,
  Store,
  FileText,
  Banknote,
  Building2,
  Globe,
  Wallet,
  Layers,
  Trash2,
  Plus,
  MessageCircle,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ClientType,
  IDENTIFIER_TYPES,
  TUNISIA_GOVERNORATES,
  COUNTRY_PHONE_PREFIXES,
  COUNTRIES,
  getIdentifierValidation,
} from '@/components/clients/types';
import { PublicFormAIAssistant } from '@/components/invoice-requests/PublicFormAIAssistant';
import { PendingRequestDialog } from '@/components/invoice-requests/PendingRequestDialog';
import { useLanguage, governorates } from '@/contexts/LanguageContext';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LanguageSelector } from '@/components/auth/LanguageSelector';
import { PublicRequestTracker } from '@/components/invoice-requests/PublicRequestTracker';
import { WithholdingCertificateDialog } from '@/components/invoice-requests/WithholdingCertificateDialog';

interface StoreData {
  id: string;
  name: string;
}

interface MixedPaymentLine {
  id: string;
  method: string;
  amount: string;
}

const PublicInvoiceRequest: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { t, language, isRTL } = useLanguage();
  
  const getDateLocale = () => {
    switch (language) { case 'ar': return arSA; case 'en': return enUS; default: return fr; }
  };

  // Page state
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationLogo, setOrganizationLogo] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activePublicTab, setActivePublicTab] = useState<'request' | 'track'>('request');
  const [showOverpaymentWarning, setShowOverpaymentWarning] = useState(false);

  // Organization tax settings for public calculation
  const [withholdingSettings, setWithholdingSettings] = useState({
    rate: 0,
    minAmount: 0,
  });
  const [stampDutyAmount, setStampDutyAmount] = useState(1);

  // Client form data
  const [clientType, setClientType] = useState<ClientType>('individual_local');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [identifierType, setIdentifierType] = useState('cin');
  const [identifierValue, setIdentifierValue] = useState('');
  const [country, setCountry] = useState('Tunisie');
  const [governorate, setGovernorate] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+216');
  const [phone, setPhone] = useState('');
  const [whatsappPrefix, setWhatsappPrefix] = useState('+216');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [countrySearch, setCountrySearch] = useState('');

  // Transaction data
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [storeId, setStoreId] = useState('');
  const [transactionNumber, setTransactionNumber] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [totalTTC, setTotalTTC] = useState('');

  // Payment data (status is automatic)
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
  const [mixedLines, setMixedLines] = useState<MixedPaymentLine[]>([]);

  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(true);
  const [linkedClientId, setLinkedClientId] = useState<string | null>(null);
  const [clientValidated, setClientValidated] = useState(false);

  // Pending requests dialog
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Withholding certificate dialog
  const [showCertificateDialog, setShowCertificateDialog] = useState(false);
  const [withholdingCertificatePath, setWithholdingCertificatePath] = useState<string | null>(null);
  const [organizationIdentifier, setOrganizationIdentifier] = useState<string>('');

  // Payment methods with i18n
  const PAYMENT_METHODS = [
    { value: 'cash', labelKey: 'cash', icon: Banknote },
    { value: 'card', labelKey: 'card', icon: CreditCard },
    { value: 'check', labelKey: 'check', icon: Receipt },
    { value: 'iban_transfer', labelKey: 'iban_transfer', icon: Building2 },
    { value: 'swift_transfer', labelKey: 'swift_transfer', icon: Globe },
    { value: 'bank_deposit', labelKey: 'bank_deposit', icon: Wallet },
    { value: 'mixed', labelKey: 'mixed_payment', icon: Layers },
  ];

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValid(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('invoice_request_links')
          .select('organization_id, is_active')
          .eq('access_token', token)
          .maybeSingle();

        if (error || !data?.is_active) {
          setIsValid(false);
        } else {
          setIsValid(true);
          setOrganizationId(data.organization_id);
          
          // Get organization name and logo via security definer function (bypasses RLS)
          const { data: orgInfo } = await supabase
            .rpc('get_organization_public_info', { org_id: data.organization_id })
            .maybeSingle();
          if (orgInfo) {
            setOrganizationName(orgInfo.name);
            setOrganizationLogo(orgInfo.logo_url);
          }

          // Get public withholding settings via security definer function
          const { data: withholdingData } = await supabase
            .rpc('get_organization_public_withholding', { org_id: data.organization_id })
            .maybeSingle();

          if (withholdingData) {
            setWithholdingSettings({
              rate: Number(withholdingData.default_withholding_rate) || 0,
              minAmount: Number(withholdingData.withholding_min_amount) || 0,
            });
          }

          // Get organization identifier for OCR validation
          const { data: orgIdentifierData } = await supabase
            .rpc('get_organization_public_identifier', { org_id: data.organization_id })
            .maybeSingle();
          if (orgIdentifierData?.identifier) {
            setOrganizationIdentifier(orgIdentifierData.identifier);
          }

          // Get stamp duty (fallback to 1.000 if inaccessible)
          const { data: stampData } = await supabase
            .from('stamp_duty_settings')
            .select('amount')
            .eq('organization_id', data.organization_id)
            .maybeSingle();

          if (stampData?.amount !== undefined && stampData?.amount !== null) {
            setStampDutyAmount(Number(stampData.amount) || 1);
          }

          // Get stores for this organization
          const { data: storesData } = await supabase
            .from('stores')
            .select('id, name')
            .eq('organization_id', data.organization_id)
            .eq('is_active', true)
            .order('name');
          if (storesData) setStores(storesData);
        }
      } catch (err) {
        setIsValid(false);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  // Real-time subscription for organization data changes
  useEffect(() => {
    if (!organizationId) return;

    // Subscribe to organization changes (name, logo, withholding settings)
    const orgChannel = supabase
      .channel(`public-org-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${organizationId}`,
        },
        async () => {
          // Refresh org info
          const { data: orgInfo } = await supabase
            .rpc('get_organization_public_info', { org_id: organizationId })
            .maybeSingle();
          if (orgInfo) {
            setOrganizationName(orgInfo.name);
            setOrganizationLogo(orgInfo.logo_url);
          }
          // Refresh withholding settings
          const { data: withholdingData } = await supabase
            .rpc('get_organization_public_withholding', { org_id: organizationId })
            .maybeSingle();
          if (withholdingData) {
            setWithholdingSettings({
              rate: Number(withholdingData.default_withholding_rate) || 0,
              minAmount: Number(withholdingData.withholding_min_amount) || 0,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to stamp duty changes
    const stampChannel = supabase
      .channel(`public-stamp-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stamp_duty_settings',
          filter: `organization_id=eq.${organizationId}`,
        },
        async () => {
          const { data: stampData } = await supabase
            .from('stamp_duty_settings')
            .select('amount')
            .eq('organization_id', organizationId)
            .maybeSingle();
          if (stampData?.amount !== undefined && stampData?.amount !== null) {
            setStampDutyAmount(Number(stampData.amount) || 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orgChannel);
      supabase.removeChannel(stampChannel);
    };
  }, [organizationId]);

  // Reset identifier type when client type changes
  useEffect(() => {
    const availableTypes = IDENTIFIER_TYPES[clientType];
    if (!availableTypes.includes(identifierType as any)) {
      setIdentifierType(availableTypes[0]);
      setIdentifierValue('');
    }
  }, [clientType]);

  // Reset country for local clients
  useEffect(() => {
    if (clientType !== 'foreign') {
      setCountry('Tunisie');
    }
  }, [clientType]);

  // Initialize mixed payment with one line
  useEffect(() => {
    if (paymentMethod === 'mixed' && mixedLines.length === 0) {
      setMixedLines([{ id: crypto.randomUUID(), method: '', amount: '' }]);
    } else if (paymentMethod !== 'mixed') {
      setMixedLines([]);
    }
  }, [paymentMethod]);

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const isLocal = clientType !== 'foreign';

  const totalTTCAmount = Math.max(0, parseFloat(totalTTC) || 0);
  const paidAmountNumber = Math.max(0, parseFloat(paidAmount) || 0);
  const shouldApplyWithholding = totalTTCAmount >= withholdingSettings.minAmount;
  const appliedWithholdingRate = shouldApplyWithholding ? withholdingSettings.rate : 0;
  const withholdingAmount = totalTTCAmount * (appliedWithholdingRate / 100);
  const netPayableAmount = totalTTCAmount - withholdingAmount + stampDutyAmount;
  const calculatedPaymentStatus: 'paid' | 'partial' | 'unpaid' =
    paidAmountNumber <= 0 ? 'unpaid' : paidAmountNumber < netPayableAmount ? 'partial' : 'paid';

  const addMixedLine = () => {
    setMixedLines([...mixedLines, { id: crypto.randomUUID(), method: '', amount: '' }]);
  };

  const removeMixedLine = (id: string) => {
    if (mixedLines.length > 1) {
      setMixedLines(mixedLines.filter(line => line.id !== id));
    }
  };

  const updateMixedLine = (id: string, field: 'method' | 'amount', value: string) => {
    setMixedLines(mixedLines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const mixedLinesTotal = mixedLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  const expectedMixedTotal = paidAmountNumber;
  const isMixedAmountValid = Math.abs(mixedLinesTotal - expectedMixedTotal) < 0.001;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (clientType === 'individual_local') {
      if (!firstName.trim()) newErrors.firstName = t('field_required');
      if (!lastName.trim()) newErrors.lastName = t('field_required');
    } else if (clientType === 'business_local') {
      if (!companyName.trim()) newErrors.companyName = t('field_required');
    } else if (clientType === 'foreign') {
      const hasName = firstName.trim() && lastName.trim();
      const hasCompany = companyName.trim();
      if (!hasName && !hasCompany) {
        newErrors.companyName = t('name_or_company_required');
      }
    }

    // Identifier validation
    const identifierValidation = getIdentifierValidation(identifierType, identifierValue);
    if (!identifierValidation.valid && identifierValidation.message) {
      newErrors.identifierValue = identifierValidation.message === 'required' ? t('field_required') :
        identifierValidation.message === 'cin_invalid' ? t('cin_invalid_format') :
        identifierValidation.message === 'tax_id_invalid' ? t('tax_id_invalid_format') : t('invalid');
    }

    // Governorate for local clients
    if (isLocal && !governorate) {
      newErrors.governorate = t('field_required');
    }

    // Country for foreign clients
    if (!isLocal && !country) {
      newErrors.country = t('field_required');
    }

    // Email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('invalid_email');
    }

    // Transaction validation
    if (!storeId) newErrors.storeId = t('field_required');
    if (!transactionNumber.trim()) newErrors.transactionNumber = t('field_required');
    if (!totalTTC || parseFloat(totalTTC) <= 0) newErrors.totalTTC = t('field_required');

    // Payment validation (status is automatic)
    if (paidAmountNumber > 0) {
      if (!paymentMethod) newErrors.paymentMethod = t('field_required');

      if (paymentMethod === 'mixed') {
        if (!isMixedAmountValid) {
          newErrors.mixedPayment = t('mixed_total_mismatch');
        }
        const invalidLines = mixedLines.some(line => !line.method || parseFloat(line.amount) <= 0);
        if (invalidLines) {
          newErrors.mixedPayment = t('fill_all_payment_methods');
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    // Skip duplicate check if we're editing an existing request
    if (!editingRequestId) {
      // Check if transaction number already exists
      const { data: existingRequest } = await supabase
        .from('invoice_requests')
        .select('id, request_number')
        .eq('organization_id', organizationId)
        .eq('transaction_number', transactionNumber.trim())
        .maybeSingle();

      if (existingRequest) {
        setErrors(prev => ({
          ...prev,
          transactionNumber: `${t('transaction_already_exists')} (${existingRequest.request_number})`
        }));
        toast.error(t('transaction_already_exists'));
        return;
      }
    }

    // Check if paid amount exceeds net payable - show warning
    if (paidAmountNumber > netPayableAmount && netPayableAmount > 0) {
      setShowOverpaymentWarning(true);
      return;
    }

    await submitRequest();
  };

  const handleConfirmOverpayment = async () => {
    setShowOverpaymentWarning(false);
    await submitRequest();
  };

  const submitRequest = async () => {
    setIsSubmitting(true);
    try {
      // Build payment methods JSON
      let paymentMethods = null;
      if (paidAmountNumber > 0) {
        if (paymentMethod === 'mixed') {
          paymentMethods = mixedLines.map(line => ({
            method: line.method,
            amount: parseFloat(line.amount) || 0
          }));
        } else {
          paymentMethods = [{ method: paymentMethod, amount: paidAmountNumber }];
        }
      }

      const requestData = {
        client_type: clientType,
        first_name: firstName || null,
        last_name: lastName || null,
        company_name: companyName || null,
        identifier_type: identifierType,
        identifier_value: identifierValue,
        country: country,
        governorate: isLocal ? governorate : null,
        address: address || null,
        postal_code: postalCode || null,
        phone_prefix: phonePrefix,
        phone: phone || null,
        whatsapp_prefix: whatsappPrefix,
        whatsapp: whatsapp || null,
        email: email || null,
        purchase_date: format(purchaseDate, 'yyyy-MM-dd'),
        store_id: storeId || null,
        transaction_number: transactionNumber,
        receipt_number: receiptNumber || null,
        order_number: orderNumber || null,
        total_ttc: totalTTCAmount,
        payment_status: calculatedPaymentStatus,
        paid_amount: paidAmountNumber,
        payment_methods: paymentMethods,
        payment_date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : null,
        linked_client_id: linkedClientId,
      };

      if (editingRequestId) {
        // UPDATE existing request
        const { error } = await supabase
          .from('invoice_requests')
          .update(requestData)
          .eq('id', editingRequestId);

        if (error) throw error;

        setIsSuccess(true);
        toast.success(t('request_updated_success'));
      } else {
        // CREATE new request
        const year = new Date().getFullYear();
        const { count } = await supabase
          .from('invoice_requests')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId);
        
        const counter = (count || 0) + 1;
        const requestNumber = `DEM-${year}-${String(counter).padStart(5, '0')}`;

        const { error } = await supabase
          .from('invoice_requests')
          .insert({
            ...requestData,
            organization_id: organizationId,
            request_number: requestNumber,
            status: 'pending',
          });

        if (error) throw error;

        setIsSuccess(true);
        toast.success(t('request_sent_success'));
      }
    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast.error(editingRequestId ? t('error_updating_request') : t('error_submitting_request'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get governorate label based on language
  const getGovernorateLabel = (value: string) => {
    const gov = governorates.find(g => g.value === value);
    if (!gov) return value;
    return gov[language as keyof typeof gov] || gov.fr;
  };

  // Get identifier type label
  const getIdentifierTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cin: t('cin'),
      tax_id: t('tax_id'),
      passport: t('passport'),
      ssn: t('ssn'),
      vat_eu: t('vat_eu'),
      business_number_ca: t('business_number_ca'),
      trade_register: t('trade_register'),
      national_id: t('national_id'),
      diplomatic_passport: t('diplomatic_passport'),
      internal_id: t('internal_id'),
    };
    return labels[type] || type;
  };

  // Get client type label
  const getClientTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      individual_local: t('individual_local'),
      business_local: t('business_local'),
      foreign: t('foreign'),
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Theme & Language toggles */}
        <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
          <LanguageSelector />
          <ThemeToggle />
        </div>
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>{t('invalid_link')}</CardTitle>
            <CardDescription>
              {t('link_expired_or_invalid')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Theme & Language toggles */}
        <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
          <LanguageSelector />
          <ThemeToggle />
        </div>
        <Card className="max-w-md w-full">
          <CardHeader className="text-center space-y-3">
            {organizationLogo ? (
              <img src={organizationLogo} alt={organizationName} className="h-12 w-12 object-contain rounded-lg mx-auto" />
            ) : organizationName ? (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            ) : null}
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <CardTitle>{t('request_sent_success')}</CardTitle>
            {organizationName && (
              <p className="text-sm font-medium text-primary">{organizationName}</p>
            )}
            <CardDescription>
              {t('request_sent_description')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-8 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Theme & Language toggles */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
        <LanguageSelector />
        <ThemeToggle />
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Editing Banner */}
        {editingRequestId && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {t('edit_mode')}
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    {t('editing_existing_request')}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingRequestId(null);
                  setClientValidated(false);
                  // Reset form fields
                  setClientType('individual_local');
                  setFirstName('');
                  setLastName('');
                  setCompanyName('');
                  setIdentifierType('cin');
                  setIdentifierValue('');
                  setCountry('Tunisie');
                  setGovernorate('');
                  setAddress('');
                  setPostalCode('');
                  setPhonePrefix('+216');
                  setPhone('');
                  setWhatsappPrefix('+216');
                  setWhatsapp('');
                  setEmail('');
                  setTransactionNumber('');
                  setReceiptNumber('');
                  setOrderNumber('');
                  setTotalTTC('');
                  setStoreId('');
                  setPurchaseDate(new Date());
                  setPaidAmount('');
                  setPaymentDate(undefined);
                  setPaymentMethod('');
                  setLinkedClientId(null);
                  toast.info(t('new_request_form_reset'));
                }}
                className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex flex-col items-center gap-3">
            {organizationLogo ? (
              <img 
                src={organizationLogo} 
                alt={organizationName} 
                className="h-16 w-16 object-contain rounded-lg border border-border shadow-sm"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center border border-border">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            )}
            <span className="text-xl font-bold text-foreground">{organizationName}</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-primary">
              {editingRequestId ? t('edit_request') : t('invoice_request')}
            </h1>
          </div>
        </div>

        {/* Tabs: New Request / Track */}
        <Tabs value={activePublicTab} onValueChange={(v) => setActivePublicTab(v as 'request' | 'track')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="request" className="gap-2">
              <FileText className="h-4 w-4" />
              {t('new_request_tab')}
            </TabsTrigger>
            <TabsTrigger value="track" className="gap-2">
              <Search className="h-4 w-4" />
              {t('track_requests_tab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="track" className="mt-6">
            <PublicRequestTracker organizationId={organizationId} />
          </TabsContent>

          <TabsContent value="request" className="mt-6 space-y-6">

        {/* Block 1: Client Information */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('your_details')}</CardTitle>
                <CardDescription>{t('billing_information')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client Type */}
            <div className="space-y-2">
              <Label>{t('client_type')} *</Label>
              <Select value={clientType} onValueChange={(v: ClientType) => setClientType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual_local">{t('individual_local')}</SelectItem>
                  <SelectItem value="business_local">{t('business_local')}</SelectItem>
                  <SelectItem value="foreign">{t('foreign')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name Fields */}
            {clientType === 'individual_local' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('first_name')} *</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={errors.firstName ? 'border-destructive' : ''}
                  />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t('last_name')} *</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={errors.lastName ? 'border-destructive' : ''}
                  />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                </div>
              </div>
            )}

            {clientType === 'business_local' && (
              <div className="space-y-2">
                <Label>{t('company_name')} *</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={errors.companyName ? 'border-destructive' : ''}
                />
                {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
              </div>
            )}

            {clientType === 'foreign' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('first_name')}</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('last_name')}</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('company_name')}</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className={errors.companyName ? 'border-destructive' : ''}
                  />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                </div>
              </>
            )}

            <Separator />

            {/* Identification */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('identifier_type')} *</Label>
                <Select value={identifierType} onValueChange={setIdentifierType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IDENTIFIER_TYPES[clientType].map((type) => (
                      <SelectItem key={type} value={type}>
                        {getIdentifierTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('identifier_value')} *</Label>
                <Input
                  value={identifierValue}
                  onChange={(e) => setIdentifierValue(e.target.value)}
                  className={errors.identifierValue ? 'border-destructive' : ''}
                  placeholder={
                    identifierType === 'cin' ? '12345678' :
                    identifierType === 'tax_id' ? '1234567/A' : ''
                  }
                />
                {errors.identifierValue && <p className="text-xs text-destructive">{errors.identifierValue}</p>}
              </div>
            </div>

            <Separator />

            {/* Location */}
            {isLocal ? (
              <div className="space-y-2">
                <Label>{t('governorate')} *</Label>
                <Select value={governorate} onValueChange={setGovernorate}>
                  <SelectTrigger className={errors.governorate ? 'border-destructive' : ''}>
                    <SelectValue placeholder={t('selectGovernorate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {governorates.map((gov) => (
                      <SelectItem key={gov.value} value={gov.value}>
                        {gov[language as keyof typeof gov] || gov.fr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.governorate && <p className="text-xs text-destructive">{errors.governorate}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t('country')} *</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className={errors.country ? 'border-destructive' : ''}>
                    <SelectValue placeholder={t('select_country')} />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input
                        placeholder={t('search')}
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="mb-2"
                      />
                    </div>
                    <ScrollArea className="h-48">
                      {filteredCountries.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('address')}</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('postal_code')}</Label>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
            </div>

            <Separator />

            {/* Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('phone')}</Label>
                <div className="flex gap-2">
                  <Select value={phonePrefix} onValueChange={setPhonePrefix}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_PHONE_PREFIXES.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.flag} {p.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="XX XXX XXX"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('whatsapp')}</Label>
                <div className="flex gap-2">
                  <Select value={whatsappPrefix} onValueChange={setWhatsappPrefix}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_PHONE_PREFIXES.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.flag} {p.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="XX XXX XXX"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('email')}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? 'border-destructive' : ''}
                placeholder="email@example.com"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Block 2: Transaction Information */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('transaction_details')}</CardTitle>
                <CardDescription>{t('purchase_information')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('purchase_date')} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(purchaseDate, 'PPP', { locale: getDateLocale() })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={purchaseDate}
                      onSelect={(date) => date && setPurchaseDate(date)}
                      initialFocus
                      locale={getDateLocale()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t('store')} *</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger className={errors.storeId ? 'border-destructive' : ''}>
                    <SelectValue placeholder={t('select_store')} />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4" />
                          {store.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.storeId && <p className="text-xs text-destructive">{errors.storeId}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('transaction_number')} *</Label>
              <Input
                value={transactionNumber}
                onChange={(e) => setTransactionNumber(e.target.value)}
                className={errors.transactionNumber ? 'border-destructive' : ''}
                placeholder={t('transaction_number_placeholder')}
              />
              {errors.transactionNumber && <p className="text-xs text-destructive">{errors.transactionNumber}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('receipt_number')}</Label>
                <Input
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder={t('optional')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('order_number')}</Label>
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder={t('optional')}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t('total_ttc')} *</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={totalTTC}
                  onChange={(e) => setTotalTTC(e.target.value)}
                  className={`${errors.totalTTC ? 'border-destructive' : ''} pr-16`}
                  placeholder="0.000"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {t('currency_label')}
                </span>
              </div>
              {errors.totalTTC && <p className="text-xs text-destructive">{errors.totalTTC}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Block 3: Payment Status */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('payment_status')}</CardTitle>
                <CardDescription>{t('payment_status_description')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('total_ttc')}</span>
                <span className="font-medium">{totalTTCAmount.toFixed(3)} {t('currency_label')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('withholding_amount')} ({appliedWithholdingRate.toFixed(2)}%)</span>
                <span className="font-medium">- {withholdingAmount.toFixed(3)} {t('currency_label')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('stamp_duty')}</span>
                <span className="font-medium">+ {stampDutyAmount.toFixed(3)} {t('currency_label')}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold">{t('net_payable')}</span>
                <span className="font-semibold text-primary">{netPayableAmount.toFixed(3)} {t('currency_label')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('paid_amount')}</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className={`${errors.paidAmount ? 'border-destructive' : ''} pr-16`}
                  placeholder="0.000"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {t('currency_label')}
                </span>
              </div>
              {errors.paidAmount && <p className="text-xs text-destructive">{errors.paidAmount}</p>}
              <p className="text-xs text-muted-foreground">0 = {t('payment_unpaid')}</p>
            </div>

            <div className="rounded-md bg-primary/5 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t('payment_status')}: </span>
              <span className="font-semibold text-primary">
                {calculatedPaymentStatus === 'paid'
                  ? t('payment_paid')
                  : calculatedPaymentStatus === 'partial'
                    ? t('payment_partial')
                    : t('payment_unpaid')}
              </span>
            </div>

            {paidAmountNumber > 0 && (
              <div className="space-y-2">
                <Label>{t('payment_date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paymentDate ? format(paymentDate, 'PPP', { locale: getDateLocale() }) : t('select_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={paymentDate}
                      onSelect={(date) => setPaymentDate(date || undefined)}
                      initialFocus
                      locale={getDateLocale()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {paidAmountNumber > 0 && (
              <>
                <Separator />

                <div className="space-y-2">
                  <Label>{t('payment_method')} *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className={errors.paymentMethod ? 'border-destructive' : ''}>
                      <SelectValue placeholder={t('select_payment_method')} />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          <div className="flex items-center gap-2">
                            <method.icon className="h-4 w-4" />
                            {t(method.labelKey)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.paymentMethod && <p className="text-xs text-destructive">{errors.paymentMethod}</p>}
                </div>

                {paymentMethod === 'mixed' && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label>{t('payment_breakdown')}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addMixedLine}
                        className="gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        {t('add')}
                      </Button>
                    </div>
                    {mixedLines.map((line) => (
                      <div key={line.id} className="flex gap-2 items-start">
                        <Select
                          value={line.method}
                          onValueChange={(v) => updateMixedLine(line.id, 'method', v)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={t('method')} />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.filter(m => m.value !== 'mixed').map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                <div className="flex items-center gap-2">
                                  <method.icon className="h-4 w-4" />
                                  {t(method.labelKey)}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="relative w-32">
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={line.amount}
                            onChange={(e) => updateMixedLine(line.id, 'amount', e.target.value)}
                            placeholder="0.000"
                            className="pr-10"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {t('currency_label')}
                          </span>
                        </div>
                        {mixedLines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMixedLine(line.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">{t('total')}:</span>
                      <span className={!isMixedAmountValid ? 'text-destructive' : 'text-green-600'}>
                        {mixedLinesTotal.toFixed(3)} / {expectedMixedTotal.toFixed(3)} {t('currency_label')}
                      </span>
                    </div>
                    {errors.mixedPayment && <p className="text-xs text-destructive">{errors.mixedPayment}</p>}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* AI Assistant */}
        {showAIAssistant && organizationId && (
          <PublicFormAIAssistant
            organizationId={organizationId}
            organizationName={organizationName}
            onClientFound={(clientData) => {
              if (clientData) {
                setClientType(clientData.client_type as ClientType);
                setFirstName(clientData.first_name || '');
                setLastName(clientData.last_name || '');
                setCompanyName(clientData.company_name || '');
                setIdentifierType(clientData.identifier_type);
                setIdentifierValue(clientData.identifier_value);
                setCountry(clientData.country);
                setGovernorate(clientData.governorate || '');
                setAddress(clientData.address || '');
                setPostalCode(clientData.postal_code || '');
                setPhonePrefix(clientData.phone_prefix || '+216');
                setPhone(clientData.phone || '');
                setWhatsappPrefix(clientData.whatsapp_prefix || '+216');
                setWhatsapp(clientData.whatsapp || '');
                setEmail(clientData.email || '');
                setLinkedClientId(clientData.id);
                setClientValidated(true);
              }
            }}
            onPendingRequestsFound={(requests) => {
              setPendingRequests(requests);
              setShowPendingDialog(true);
            }}
            onClose={() => setShowAIAssistant(false)}
            clientValidated={clientValidated}
          />
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-12 text-lg gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('submitting')}...
            </>
          ) : (
            <>
              <FileText className="h-5 w-5" />
              {editingRequestId ? t('update_request') : t('submit_request')}
            </>
          )}
        </Button>

        {/* AI Chat Button */}
        <div className="fixed bottom-6 right-6">
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => setShowAIAssistant(!showAIAssistant)}
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </div>

        </TabsContent>
        </Tabs>
      </div>


      {/* Pending Requests Dialog */}
      <PendingRequestDialog
        open={showPendingDialog}
        onOpenChange={setShowPendingDialog}
        requests={pendingRequests}
        stores={stores}
        onEditRequest={(request) => {
          setEditingRequestId(request.id);
          setClientType((request.client_type || 'individual_local') as ClientType);
          setFirstName(request.first_name || '');
          setLastName(request.last_name || '');
          setCompanyName(request.company_name || '');
          setIdentifierType(request.identifier_type || 'cin');
          setIdentifierValue(request.identifier_value);
          setCountry(request.country || 'Tunisie');
          setGovernorate(request.governorate || '');
          setAddress(request.address || '');
          setPostalCode(request.postal_code || '');
          setPhonePrefix(request.phone_prefix || '+216');
          setPhone(request.phone || '');
          setWhatsappPrefix(request.whatsapp_prefix || '+216');
          setWhatsapp(request.whatsapp || '');
          setEmail(request.email || '');
          setTransactionNumber(request.transaction_number);
          setReceiptNumber(request.receipt_number || '');
          setOrderNumber(request.order_number || '');
          setTotalTTC(request.total_ttc.toString());
          setStoreId(request.store_id || '');
          setPurchaseDate(new Date(request.purchase_date));
          setPaidAmount(request.paid_amount?.toString() || '');
          setPaymentDate(request.payment_date ? new Date(request.payment_date) : undefined);
          setLinkedClientId(request.linked_client_id || null);
          setClientValidated(true);
          setShowPendingDialog(false);
          toast.info(t('request_loaded_for_editing'));
        }}
      />

      {/* Overpayment Warning Dialog */}
      <AlertDialog open={showOverpaymentWarning} onOpenChange={setShowOverpaymentWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              {t('overpayment_warning_title') || 'Montant supérieur au Net à Payer'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('overpayment_warning_message') || 'Le montant payé saisi est supérieur au Net à Payer.'}
              </p>
              <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t('net_payable')}</span>
                  <span className="font-medium">{netPayableAmount.toFixed(3)} {t('currency_label')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('paid_amount')}</span>
                  <span className="font-medium">{paidAmountNumber.toFixed(3)} {t('currency_label')}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-primary font-semibold">
                  <span>{t('client_balance_difference') || 'Différence (solde client)'}</span>
                  <span>{(paidAmountNumber - netPayableAmount).toFixed(3)} {t('currency_label')}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('overpayment_balance_note') || 'La différence sera enregistrée comme solde client après validation de la réception réelle de ce montant.'}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverpayment}>
              {t('confirm_submit') || 'Confirmer et soumettre'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PublicInvoiceRequest;
