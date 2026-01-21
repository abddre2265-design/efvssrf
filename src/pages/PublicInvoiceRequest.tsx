import React, { useState, useEffect } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Receipt, 
  CreditCard,
  CalendarIcon,
  Store,
  FileText,
  Search,
  Banknote,
  Building2,
  Globe,
  Wallet,
  Layers,
  Trash2,
  Plus,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

// Payment methods available for public form
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces', icon: Banknote },
  { value: 'card', label: 'Carte bancaire', icon: CreditCard },
  { value: 'check', label: 'Chèque', icon: Receipt },
  { value: 'iban_transfer', label: 'Virement IBAN', icon: Building2 },
  { value: 'swift_transfer', label: 'Virement SWIFT', icon: Globe },
  { value: 'bank_deposit', label: 'Versement bancaire', icon: Wallet },
  { value: 'mixed', label: 'Paiement mixte', icon: Layers },
];

interface StoreData {
  id: string;
  name: string;
}

interface MixedPaymentLine {
  id: string;
  method: string;
  amount: string;
}

interface ClientData {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  identifier_type: string;
  identifier_value: string;
  country: string;
  governorate: string | null;
  address: string | null;
  postal_code: string | null;
  phone_prefix: string | null;
  phone: string | null;
  whatsapp_prefix: string | null;
  whatsapp: string | null;
  email: string | null;
}

const PublicInvoiceRequest: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  
  // Page state
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Confirmation dialog for partial payment treated as paid
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);

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

  // Payment status
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'unpaid'>('unpaid');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [mixedLines, setMixedLines] = useState<MixedPaymentLine[]>([]);

  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(true);
  const [linkedClientId, setLinkedClientId] = useState<string | null>(null);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

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
          
          // Get organization name
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', data.organization_id)
            .maybeSingle();
          if (org) setOrganizationName(org.name);

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
  const expectedMixedTotal = paymentStatus === 'paid' ? parseFloat(totalTTC) || 0 : parseFloat(paidAmount) || 0;
  const isMixedAmountValid = Math.abs(mixedLinesTotal - expectedMixedTotal) < 0.001;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (clientType === 'individual_local') {
      if (!firstName.trim()) newErrors.firstName = 'Requis';
      if (!lastName.trim()) newErrors.lastName = 'Requis';
    } else if (clientType === 'business_local') {
      if (!companyName.trim()) newErrors.companyName = 'Requis';
    } else if (clientType === 'foreign') {
      const hasName = firstName.trim() && lastName.trim();
      const hasCompany = companyName.trim();
      if (!hasName && !hasCompany) {
        newErrors.companyName = 'Nom ou raison sociale requis';
      }
    }

    // Identifier validation
    const identifierValidation = getIdentifierValidation(identifierType, identifierValue);
    if (!identifierValidation.valid && identifierValidation.message) {
      newErrors.identifierValue = identifierValidation.message === 'required' ? 'Requis' :
        identifierValidation.message === 'cin_invalid' ? 'CIN invalide (8 chiffres)' :
        identifierValidation.message === 'tax_id_invalid' ? 'Matricule fiscal invalide' : 'Invalide';
    }

    // Governorate for local clients
    if (isLocal && !governorate) {
      newErrors.governorate = 'Requis';
    }

    // Country for foreign clients
    if (!isLocal && !country) {
      newErrors.country = 'Requis';
    }

    // Email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email invalide';
    }

    // Transaction validation
    if (!storeId) newErrors.storeId = 'Requis';
    if (!transactionNumber.trim()) newErrors.transactionNumber = 'Requis';
    if (!totalTTC || parseFloat(totalTTC) <= 0) newErrors.totalTTC = 'Requis';

    // Payment validation
    if (paymentStatus !== 'unpaid') {
      if (!paymentMethod) newErrors.paymentMethod = 'Requis';
      
      if (paymentStatus === 'partial') {
        const paid = parseFloat(paidAmount) || 0;
        const total = parseFloat(totalTTC) || 0;
        if (paid <= 0) newErrors.paidAmount = 'Requis';
        if (paid > total) newErrors.paidAmount = 'Supérieur au total';
      }

      if (paymentMethod === 'mixed') {
        if (!isMixedAmountValid) {
          newErrors.mixedPayment = 'Le total des paiements doit correspondre au montant';
        }
        const invalidLines = mixedLines.some(line => !line.method || parseFloat(line.amount) <= 0);
        if (invalidLines) {
          newErrors.mixedPayment = 'Veuillez remplir tous les modes de paiement';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

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
        transactionNumber: `Ce numéro de transaction existe déjà (Demande N° ${existingRequest.request_number})`
      }));
      toast.error('Ce numéro de transaction a déjà été utilisé pour une autre demande');
      return;
    }

    // Check if partial payment equals total
    if (paymentStatus === 'partial') {
      const paid = parseFloat(paidAmount) || 0;
      const total = parseFloat(totalTTC) || 0;
      if (Math.abs(paid - total) < 0.001) {
        setShowPaymentConfirm(true);
        return;
      }
    }

    await submitRequest();
  };

  const submitRequest = async () => {
    setIsSubmitting(true);
    try {
      // Generate request number
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from('invoice_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);
      
      const counter = (count || 0) + 1;
      const requestNumber = `DEM-${year}-${String(counter).padStart(5, '0')}`;

      // Build payment methods JSON
      let paymentMethods = null;
      if (paymentStatus !== 'unpaid') {
        if (paymentMethod === 'mixed') {
          paymentMethods = mixedLines.map(line => ({
            method: line.method,
            amount: parseFloat(line.amount) || 0
          }));
        } else {
          paymentMethods = [{ method: paymentMethod, amount: paymentStatus === 'paid' ? parseFloat(totalTTC) : parseFloat(paidAmount) }];
        }
      }

      const { error } = await supabase
        .from('invoice_requests')
        .insert({
          organization_id: organizationId,
          request_number: requestNumber,
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
          total_ttc: parseFloat(totalTTC),
          payment_status: paymentStatus,
          paid_amount: paymentStatus === 'paid' ? parseFloat(totalTTC) : (paymentStatus === 'partial' ? parseFloat(paidAmount) : 0),
          payment_methods: paymentMethods,
          status: 'pending',
        });

      if (error) throw error;

      setIsSuccess(true);
      toast.success('Demande envoyée avec succès');
    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast.error('Erreur lors de l\'envoi de la demande');
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>Lien invalide</CardTitle>
            <CardDescription>
              Ce lien de demande de facture n'est plus valide ou a expiré.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <CardTitle>Demande envoyée !</CardTitle>
            <CardDescription>
              Votre demande de facture a été transmise à {organizationName}. 
              Vous serez contacté pour la suite.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <FileText className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Demande de facture</h1>
          {organizationName && (
            <p className="text-muted-foreground">{organizationName}</p>
          )}
        </div>

        {/* Block 1: Client Information */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Vos coordonnées</CardTitle>
                <CardDescription>Informations pour la facturation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client Type */}
            <div className="space-y-2">
              <Label>Type de client *</Label>
              <Select value={clientType} onValueChange={(v: ClientType) => setClientType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual_local">Particulier (Tunisie)</SelectItem>
                  <SelectItem value="business_local">Entreprise (Tunisie)</SelectItem>
                  <SelectItem value="foreign">Client étranger</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name Fields */}
            {clientType === 'individual_local' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom *</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={errors.firstName ? 'border-destructive' : ''}
                  />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
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
                <Label>Raison sociale *</Label>
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
                    <Label>Prénom</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Raison sociale</Label>
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
                <Label>Type d'identifiant *</Label>
                <Select value={identifierType} onValueChange={setIdentifierType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IDENTIFIER_TYPES[clientType].map((type) => (
                      <SelectItem key={type} value={type}>
                        {type === 'cin' ? 'CIN' :
                         type === 'tax_id' ? 'Matricule fiscal' :
                         type === 'passport' ? 'Passeport' :
                         type === 'ssn' ? 'Numéro SS' :
                         type === 'vat_eu' ? 'TVA UE' :
                         type === 'business_number_ca' ? 'NE Canada' :
                         type === 'trade_register' ? 'Registre commerce' :
                         type === 'national_id' ? 'ID National' :
                         type === 'diplomatic_passport' ? 'Passeport diplomatique' :
                         type === 'internal_id' ? 'ID Interne' : type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valeur *</Label>
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

            {/* Address */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Adresse</h4>
              
              {/* Country */}
              <div className="space-y-2">
                <Label>Pays {!isLocal && '*'}</Label>
                {isLocal ? (
                  <Input value="Tunisie" disabled className="bg-muted" />
                ) : (
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className={errors.country ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Sélectionner un pays" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Rechercher..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>
                      <ScrollArea className="h-[200px]">
                        {filteredCountries.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                )}
                {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
              </div>

              {/* Governorate */}
              {isLocal && (
                <div className="space-y-2">
                  <Label>Gouvernorat *</Label>
                  <Select value={governorate} onValueChange={setGovernorate}>
                    <SelectTrigger className={errors.governorate ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {TUNISIA_GOVERNORATES.map((gov) => (
                        <SelectItem key={gov} value={gov}>{gov}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.governorate && <p className="text-xs text-destructive">{errors.governorate}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Contact</h4>
              
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <div className="flex gap-2">
                  <Select value={phonePrefix} onValueChange={setPhonePrefix}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_PHONE_PREFIXES.map((prefix) => (
                        <SelectItem key={prefix.code} value={prefix.code}>
                          {prefix.flag} {prefix.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1"
                    placeholder="12345678"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <div className="flex gap-2">
                  <Select value={whatsappPrefix} onValueChange={setWhatsappPrefix}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_PHONE_PREFIXES.map((prefix) => (
                        <SelectItem key={prefix.code} value={prefix.code}>
                          {prefix.flag} {prefix.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="flex-1"
                    placeholder="12345678"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
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
                <CardTitle className="text-lg">Informations de transaction</CardTitle>
                <CardDescription>Détails de votre achat</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date d'achat *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(purchaseDate, 'dd/MM/yyyy', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={purchaseDate}
                      onSelect={(date) => date && setPurchaseDate(date)}
                      initialFocus
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Magasin *</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger className={errors.storeId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Sélectionner" />
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
              <Label>Numéro de transaction *</Label>
              <Input
                value={transactionNumber}
                onChange={(e) => setTransactionNumber(e.target.value)}
                className={errors.transactionNumber ? 'border-destructive' : ''}
              />
              {errors.transactionNumber && <p className="text-xs text-destructive">{errors.transactionNumber}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Numéro de ticket de caisse</Label>
                <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Numéro de commande</Label>
                <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Montant total TTC (DT) *</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={totalTTC}
                onChange={(e) => setTotalTTC(e.target.value)}
                className={errors.totalTTC ? 'border-destructive' : ''}
              />
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
                <CardTitle className="text-lg">Statut de paiement</CardTitle>
                <CardDescription>Indiquez le statut du paiement</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={paymentStatus} onValueChange={(v: 'paid' | 'partial' | 'unpaid') => setPaymentStatus(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="paid" id="paid" />
                <Label htmlFor="paid" className="cursor-pointer">Payée</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="cursor-pointer">Partiellement payée</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unpaid" id="unpaid" />
                <Label htmlFor="unpaid" className="cursor-pointer">Impayée</Label>
              </div>
            </RadioGroup>

            {/* Block 4: Payment Details (shown when paid or partial) */}
            {paymentStatus !== 'unpaid' && (
              <>
                <Separator />

                {paymentStatus === 'partial' && (
                  <div className="space-y-2">
                    <Label>Montant payé (DT) *</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      max={totalTTC}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className={errors.paidAmount ? 'border-destructive' : ''}
                    />
                    {errors.paidAmount && <p className="text-xs text-destructive">{errors.paidAmount}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Mode de paiement *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className={errors.paymentMethod ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => {
                        const Icon = method.icon;
                        return (
                          <SelectItem key={method.value} value={method.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {method.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {errors.paymentMethod && <p className="text-xs text-destructive">{errors.paymentMethod}</p>}
                </div>

                {/* Mixed Payment Lines */}
                {paymentMethod === 'mixed' && (
                  <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Détail des paiements</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={addMixedLine}>
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter
                      </Button>
                    </div>

                    {mixedLines.map((line, index) => (
                      <div key={line.id} className="flex items-center gap-2">
                        <Select
                          value={line.method}
                          onValueChange={(v) => updateMixedLine(line.id, 'method', v)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Mode" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.filter(m => m.value !== 'mixed').map((method) => {
                              const Icon = method.icon;
                              return (
                                <SelectItem key={method.value} value={method.value}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    {method.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={line.amount}
                          onChange={(e) => updateMixedLine(line.id, 'amount', e.target.value)}
                          placeholder="Montant"
                          className="w-32"
                        />
                        {mixedLines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeMixedLine(line.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}

                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span>Total:</span>
                      <span className={!isMixedAmountValid ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                        {mixedLinesTotal.toFixed(3)} DT / {expectedMixedTotal.toFixed(3)} DT
                      </span>
                    </div>
                    {errors.mixedPayment && <p className="text-xs text-destructive">{errors.mixedPayment}</p>}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button 
          onClick={handleSubmit} 
          className="w-full h-12 text-lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Envoyer la demande
            </>
          )}
        </Button>
      </div>

      {/* Confirmation Dialog for partial = total */}
      <AlertDialog open={showPaymentConfirm} onOpenChange={setShowPaymentConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le statut de paiement</AlertDialogTitle>
            <AlertDialogDescription>
              Le montant payé est égal au montant total. Ce paiement sera traité comme "Payé" et non "Partiellement payé".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler pour corriger</AlertDialogCancel>
            <AlertDialogAction onClick={submitRequest}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Assistant */}
      {showAIAssistant && organizationId && (
        <PublicFormAIAssistant
          organizationId={organizationId}
          organizationName={organizationName}
          onClientFound={(client) => {
            // Fill form with client data
            setClientType(client.client_type as ClientType);
            setFirstName(client.first_name || '');
            setLastName(client.last_name || '');
            setCompanyName(client.company_name || '');
            setIdentifierType(client.identifier_type);
            setIdentifierValue(client.identifier_value);
            setCountry(client.country);
            setGovernorate(client.governorate || '');
            setAddress(client.address || '');
            setPostalCode(client.postal_code || '');
            setPhonePrefix(client.phone_prefix || '+216');
            setPhone(client.phone || '');
            setWhatsappPrefix(client.whatsapp_prefix || '+216');
            setWhatsapp(client.whatsapp || '');
            setEmail(client.email || '');
            setLinkedClientId(client.id);
          }}
          onLoadPendingRequest={(request) => {
            // Fill transaction data from pending request
            setTransactionNumber(request.transaction_number);
            setTotalTTC(String(request.total_ttc));
            if (request.store_id) setStoreId(request.store_id);
            if (request.purchase_date) setPurchaseDate(new Date(request.purchase_date));
          }}
          onClose={() => setShowAIAssistant(false)}
        />
      )}

      {/* Floating button to reopen AI Assistant */}
      {!showAIAssistant && (
        <Button
          onClick={() => setShowAIAssistant(true)}
          className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default PublicInvoiceRequest;
