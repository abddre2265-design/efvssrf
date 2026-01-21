import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Building2, 
  User, 
  Globe,
  CheckCircle2,
  Search,
  Plus,
  Loader2,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { ExtractedSupplier } from './types';
import {
  Supplier,
  SupplierFormData,
  SupplierType,
  SUPPLIER_IDENTIFIER_TYPES,
  TUNISIA_GOVERNORATES,
  COUNTRY_PHONE_PREFIXES,
  COUNTRIES,
  getIdentifierValidation,
} from '@/components/suppliers/types';

interface SupplierIdentificationStepProps {
  extractedSupplier: ExtractedSupplier | null;
  organizationId: string;
  onSupplierConfirmed: (supplierId: string, isNew: boolean, supplierType?: 'individual_local' | 'business_local' | 'foreign') => void;
}

export const SupplierIdentificationStep: React.FC<SupplierIdentificationStepProps> = ({
  extractedSupplier,
  organizationId,
  onSupplierConfirmed,
}) => {
  const { t, isRTL } = useLanguage();
  
  // State
  const [existingSuppliers, setExistingSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [matchedSupplier, setMatchedSupplier] = useState<Supplier | null>(null);
  const [mode, setMode] = useState<'matched' | 'select_existing' | 'create_new'>('matched');
  const [selectedExistingId, setSelectedExistingId] = useState<string>('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [countrySearch, setCountrySearch] = useState('');

  // Map country code to country name
  const mapCountryCodeToName = (code: string | null): string => {
    if (!code) return 'Tunisie';
    const countryMap: Record<string, string> = {
      'TN': 'Tunisie', 'FR': 'France', 'DE': 'Allemagne', 'IT': 'Italie',
      'ES': 'Espagne', 'US': 'États-Unis', 'CN': 'Chine', 'TR': 'Turquie',
      'AE': 'Émirats arabes unis', 'SA': 'Arabie saoudite', 'EG': 'Égypte',
      'MA': 'Maroc', 'DZ': 'Algérie', 'LY': 'Libye', 'GB': 'Royaume-Uni',
      'JP': 'Japon', 'KR': 'Corée du Sud', 'IN': 'Inde', 'BR': 'Brésil',
    };
    // If it's already a full name, return it
    if (code.length > 2) return code;
    return countryMap[code.toUpperCase()] || code;
  };

  // Map identifier type to the values expected by SupplierFormData / validation
  // (see SUPPLIER_IDENTIFIER_TYPES in '@/components/suppliers/types')
  const mapIdentifierType = (
    type: string | null,
    supplierType: SupplierType | null,
  ): string => {
    if (!type) {
      // For local businesses, the only allowed type is 'tax_id'
      if (supplierType === 'business_local') return 'tax_id';
      return 'cin';
    }

    const normalized = type.trim().toUpperCase();
    const typeMap: Record<string, string> = {
      // Tunisian naming coming from AI
      MF: 'tax_id',
      CIN: 'cin',
      PASSPORT: 'passport',
      RNE: 'trade_register',

      // Already-normalized values
      TAX_ID: 'tax_id',
      VAT_EU: 'vat_eu',
    };

    return typeMap[normalized] || type.toLowerCase();
  };

  // Form data for new supplier
  const [formData, setFormData] = useState<SupplierFormData>({
    supplierType: extractedSupplier?.supplier_type || 'individual_local',
    firstName: extractedSupplier?.first_name || '',
    lastName: extractedSupplier?.last_name || '',
    companyName: extractedSupplier?.company_name || extractedSupplier?.name || '',
    identifierType: mapIdentifierType(extractedSupplier?.identifier_type, extractedSupplier?.supplier_type ?? null),
    identifierValue: extractedSupplier?.identifier_value || '',
    country: mapCountryCodeToName(extractedSupplier?.country),
    governorate: extractedSupplier?.governorate || '',
    address: extractedSupplier?.address || '',
    postalCode: extractedSupplier?.postal_code || '',
    phonePrefix: extractedSupplier?.phone_prefix || '+216',
    phone: extractedSupplier?.phone || '',
    whatsappPrefix: extractedSupplier?.whatsapp_prefix || '+216',
    whatsapp: extractedSupplier?.whatsapp || '',
    email: extractedSupplier?.email || '',
  });

  const isLocal = formData.supplierType !== 'foreign';
  const isIdentifierRequired = isLocal;

  // Load existing suppliers and check for matches
  useEffect(() => {
    const loadAndMatchSuppliers = async () => {
      setLoadingSuppliers(true);
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .order('company_name', { ascending: true });

        if (error) throw error;
        
        const suppliers = (data || []) as Supplier[];
        setExistingSuppliers(suppliers);

        // Try to match with extracted supplier
        if (extractedSupplier) {
          // First check if already matched by the edge function
          if (extractedSupplier.is_existing && extractedSupplier.existing_supplier_id) {
            const matched = suppliers.find(s => s.id === extractedSupplier.existing_supplier_id);
            if (matched) {
              setMatchedSupplier(matched);
              setMode('matched');
              return;
            }
          }

          // Try to match by name or identifier
          const matchByName = suppliers.find(s => {
            const extractedName = extractedSupplier.name?.toLowerCase().trim();
            const supplierName = s.company_name?.toLowerCase().trim() 
              || `${s.first_name} ${s.last_name}`.toLowerCase().trim();
            return extractedName && supplierName && (
              supplierName.includes(extractedName) || extractedName.includes(supplierName)
            );
          });

          const matchByIdentifier = extractedSupplier.identifier_value 
            ? suppliers.find(s => 
                s.identifier_value?.toLowerCase() === extractedSupplier.identifier_value?.toLowerCase()
              )
            : null;

          if (matchByIdentifier) {
            setMatchedSupplier(matchByIdentifier);
            setMode('matched');
          } else if (matchByName) {
            setMatchedSupplier(matchByName);
            setMode('matched');
          } else {
            // No match found, go to create mode with extracted data
            setMode('create_new');
          }
        } else {
          setMode('select_existing');
        }
      } catch (error) {
        console.error('Error loading suppliers:', error);
        toast.error(t('error_loading_suppliers') || 'Erreur de chargement des fournisseurs');
      } finally {
        setLoadingSuppliers(false);
      }
    };

    loadAndMatchSuppliers();
  }, [organizationId, extractedSupplier, t]);

  // Reset identifier type when supplier type changes
  useEffect(() => {
    const availableTypes = SUPPLIER_IDENTIFIER_TYPES[formData.supplierType];
    if (!availableTypes.includes(formData.identifierType as any)) {
      setFormData(prev => ({
        ...prev,
        identifierType: availableTypes[0] || '',
        identifierValue: '',
      }));
    }
  }, [formData.supplierType]);

  // Reset country for local suppliers
  useEffect(() => {
    if (formData.supplierType !== 'foreign') {
      setFormData(prev => ({ ...prev, country: 'Tunisie' }));
    }
  }, [formData.supplierType]);

  const handleChange = (field: keyof SupplierFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (formData.supplierType === 'individual_local') {
      if (!formData.firstName.trim()) newErrors.firstName = t('required') || 'Obligatoire';
      if (!formData.lastName.trim()) newErrors.lastName = t('required') || 'Obligatoire';
    } else if (formData.supplierType === 'business_local') {
      if (!formData.companyName.trim()) newErrors.companyName = t('required') || 'Obligatoire';
    } else if (formData.supplierType === 'foreign') {
      const hasName = formData.firstName.trim() && formData.lastName.trim();
      const hasCompany = formData.companyName.trim();
      if (!hasName && !hasCompany) {
        newErrors.companyName = t('name_or_company_required') || 'Nom ou raison sociale requis';
      }
    }

    // Identifier validation (only required for local)
    if (isIdentifierRequired) {
      if (!formData.identifierType) {
        newErrors.identifierType = t('required') || 'Obligatoire';
      }
      
      const identifierValidation = getIdentifierValidation(
        formData.identifierType, 
        formData.identifierValue, 
        true
      );
      if (!identifierValidation.valid && identifierValidation.message) {
        newErrors.identifierValue = t(identifierValidation.message) || identifierValidation.message;
      }
    } else if (formData.identifierValue) {
      const identifierValidation = getIdentifierValidation(
        formData.identifierType, 
        formData.identifierValue, 
        false
      );
      if (!identifierValidation.valid && identifierValidation.message) {
        newErrors.identifierValue = t(identifierValidation.message) || identifierValidation.message;
      }
    }

    // Governorate for local suppliers
    if (isLocal && !formData.governorate) {
      newErrors.governorate = t('required') || 'Obligatoire';
    }

    // Email validation if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('invalid_email') || 'Email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirmMatched = () => {
    if (matchedSupplier) {
      onSupplierConfirmed(matchedSupplier.id, false, matchedSupplier.supplier_type);
    }
  };

  const handleConfirmExisting = () => {
    if (selectedExistingId) {
      const selectedSupplier = existingSuppliers.find(s => s.id === selectedExistingId);
      onSupplierConfirmed(selectedExistingId, false, selectedSupplier?.supplier_type);
    }
  };

  const handleCreateNew = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const insertData = {
        organization_id: organizationId,
        supplier_type: formData.supplierType,
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        company_name: formData.companyName || null,
        identifier_type: formData.identifierType || null,
        identifier_value: formData.identifierValue || null,
        country: formData.country,
        governorate: formData.governorate || null,
        address: formData.address || null,
        postal_code: formData.postalCode || null,
        phone_prefix: formData.phonePrefix || null,
        phone: formData.phone || null,
        whatsapp_prefix: formData.whatsappPrefix || null,
        whatsapp: formData.whatsapp || null,
        email: formData.email || null,
        status: 'active' as const,
      };

      const { data, error } = await supabase
        .from('suppliers')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      toast.success(t('supplier_created') || 'Fournisseur créé avec succès');
      onSupplierConfirmed(data.id, true, formData.supplierType);

    } catch (error) {
      console.error('Error creating supplier:', error);
      toast.error(t('error_creating_supplier') || 'Erreur lors de la création du fournisseur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = existingSuppliers.filter(s => {
    const name = s.company_name || `${s.first_name} ${s.last_name}`;
    return name.toLowerCase().includes(supplierSearch.toLowerCase());
  });

  const filteredCountries = COUNTRIES.filter(country =>
    country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const getSupplierDisplayName = (supplier: Supplier): string => {
    return supplier.company_name || `${supplier.first_name} ${supplier.last_name}`;
  };

  const getSupplierTypeIcon = (type: SupplierType) => {
    switch (type) {
      case 'individual_local': return <User className="h-4 w-4" />;
      case 'business_local': return <Building2 className="h-4 w-4" />;
      case 'foreign': return <Globe className="h-4 w-4" />;
    }
  };

  if (loadingSuppliers) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t('supplier_identification') || 'Identification du fournisseur'}
        </CardTitle>
        <CardDescription>
          {t('supplier_identification_description') || 'Confirmez ou créez le fournisseur pour cet achat'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Matched Supplier */}
        {mode === 'matched' && matchedSupplier && (
          <>
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertTitle className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                {t('supplier_found') || 'Fournisseur trouvé'}
                {extractedSupplier?.match_confidence && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      extractedSupplier.match_confidence >= 90 
                        ? 'border-green-500 text-green-600' 
                        : extractedSupplier.match_confidence >= 70 
                          ? 'border-yellow-500 text-yellow-600' 
                          : 'border-orange-500 text-orange-600'
                    }`}
                  >
                    {extractedSupplier.match_confidence}% confiance
                  </Badge>
                )}
              </AlertTitle>
              <AlertDescription className="text-green-700/80 dark:text-green-400/80">
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {getSupplierTypeIcon(matchedSupplier.supplier_type)}
                  <span className="font-medium">{getSupplierDisplayName(matchedSupplier)}</span>
                  {matchedSupplier.identifier_value && (
                    <Badge variant="outline" className="text-xs">
                      {matchedSupplier.identifier_type?.toUpperCase()}: {matchedSupplier.identifier_value}
                    </Badge>
                  )}
                </div>
                {extractedSupplier?.match_reason && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {extractedSupplier.match_reason}
                  </p>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleConfirmMatched} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t('confirm_supplier') || 'Confirmer ce fournisseur'}
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setMode('select_existing')}
              >
                {t('change_supplier') || 'Changer de fournisseur'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setMode('create_new')}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('create_new_supplier') || 'Créer nouveau'}
              </Button>
            </div>
          </>
        )}

        {/* Select Existing Supplier */}
        {mode === 'select_existing' && (
          <>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('search_supplier') || 'Rechercher un fournisseur...'}
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <ScrollArea className="h-[200px] border rounded-md p-2">
                {filteredSuppliers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {t('no_suppliers_found') || 'Aucun fournisseur trouvé'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredSuppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedExistingId === supplier.id 
                            ? 'bg-primary/10 border border-primary' 
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => setSelectedExistingId(supplier.id)}
                      >
                        {getSupplierTypeIcon(supplier.supplier_type)}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{getSupplierDisplayName(supplier)}</p>
                          {supplier.identifier_value && (
                            <p className="text-xs text-muted-foreground">
                              {supplier.identifier_type?.toUpperCase()}: {supplier.identifier_value}
                            </p>
                          )}
                        </div>
                        {selectedExistingId === supplier.id && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={handleConfirmExisting} 
                disabled={!selectedExistingId}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t('use_selected_supplier') || 'Utiliser ce fournisseur'}
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setMode('create_new')}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('create_new_supplier') || 'Créer nouveau'}
              </Button>
              {matchedSupplier && (
                <Button 
                  variant="ghost" 
                  onClick={() => setMode('matched')}
                >
                  {t('back') || 'Retour'}
                </Button>
              )}
            </div>
          </>
        )}

        {/* Create New Supplier Form */}
        {mode === 'create_new' && (
          <>
            {extractedSupplier && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('extracted_data') || 'Données extraites'}</AlertTitle>
                <AlertDescription className="text-sm">
                  {t('verify_extracted_data') || 'Vérifiez et complétez les informations ci-dessous avant de créer le fournisseur.'}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-6">
              {/* Supplier Type */}
              <div className="space-y-2">
                <Label>{t('supplier_type') || 'Type de fournisseur'} *</Label>
                <Select
                  value={formData.supplierType}
                  onValueChange={(value: SupplierType) => handleChange('supplierType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual_local">{t('individual_local') || 'Particulier local'}</SelectItem>
                    <SelectItem value="business_local">{t('business_local') || 'Entreprise locale'}</SelectItem>
                    <SelectItem value="foreign">{t('foreign_supplier') || 'Fournisseur étranger'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name Fields */}
              <div className="space-y-4">
                {formData.supplierType === 'individual_local' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('first_name') || 'Prénom'} *</Label>
                      <Input
                        value={formData.firstName}
                        onChange={(e) => handleChange('firstName', e.target.value)}
                        className={errors.firstName ? 'border-destructive' : ''}
                      />
                      {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>{t('last_name') || 'Nom'} *</Label>
                      <Input
                        value={formData.lastName}
                        onChange={(e) => handleChange('lastName', e.target.value)}
                        className={errors.lastName ? 'border-destructive' : ''}
                      />
                      {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                    </div>
                  </div>
                )}

                {formData.supplierType === 'business_local' && (
                  <div className="space-y-2">
                    <Label>{t('company_name') || 'Raison sociale'} *</Label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      className={errors.companyName ? 'border-destructive' : ''}
                    />
                    {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                  </div>
                )}

                {formData.supplierType === 'foreign' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('first_name') || 'Prénom'}</Label>
                        <Input
                          value={formData.firstName}
                          onChange={(e) => handleChange('firstName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('last_name') || 'Nom'}</Label>
                        <Input
                          value={formData.lastName}
                          onChange={(e) => handleChange('lastName', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('company_name') || 'Raison sociale'}</Label>
                      <Input
                        value={formData.companyName}
                        onChange={(e) => handleChange('companyName', e.target.value)}
                        className={errors.companyName ? 'border-destructive' : ''}
                      />
                      {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                    </div>
                  </>
                )}
              </div>

              {/* Identification */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('identifier_type') || 'Type d\'identifiant'} {isIdentifierRequired && '*'}</Label>
                  <Select
                    value={formData.identifierType}
                    onValueChange={(value) => handleChange('identifierType', value)}
                  >
                    <SelectTrigger className={errors.identifierType ? 'border-destructive' : ''}>
                      <SelectValue placeholder={t('select_identifier_type') || 'Sélectionner'} />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_IDENTIFIER_TYPES[formData.supplierType].map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`identifier_${type}`) || type.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.identifierType && <p className="text-xs text-destructive">{errors.identifierType}</p>}
                </div>

                <div className="space-y-2">
                  <Label>{t('identifier_value') || 'Valeur'} {isIdentifierRequired && '*'}</Label>
                  <Input
                    value={formData.identifierValue}
                    onChange={(e) => handleChange('identifierValue', e.target.value)}
                    className={errors.identifierValue ? 'border-destructive' : ''}
                    placeholder={
                      formData.identifierType === 'cin' ? '12345678' :
                      formData.identifierType === 'tax_id' ? '1234567/A' : ''
                    }
                  />
                  {errors.identifierValue && <p className="text-xs text-destructive">{errors.identifierValue}</p>}
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground">{t('address') || 'Adresse'}</h3>
                
                {/* Country */}
                <div className="space-y-2">
                  <Label>{t('country') || 'Pays'}</Label>
                  {isLocal ? (
                    <Input value="Tunisie" disabled className="bg-muted" />
                  ) : (
                    <Select
                      value={formData.country}
                      onValueChange={(value) => handleChange('country', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_country') || 'Sélectionner'} />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t('search') || 'Rechercher'}
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredCountries.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Governorate (only for local) */}
                {isLocal && (
                  <div className="space-y-2">
                    <Label>{t('governorate') || 'Gouvernorat'} *</Label>
                    <Select
                      value={formData.governorate}
                      onValueChange={(value) => handleChange('governorate', value)}
                    >
                      <SelectTrigger className={errors.governorate ? 'border-destructive' : ''}>
                        <SelectValue placeholder={t('select_governorate') || 'Sélectionner'} />
                      </SelectTrigger>
                      <SelectContent>
                        {TUNISIA_GOVERNORATES.map((gov) => (
                          <SelectItem key={gov} value={gov}>
                            {gov}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.governorate && <p className="text-xs text-destructive">{errors.governorate}</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('address_line') || 'Adresse'}</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('postal_code') || 'Code postal'}</Label>
                    <Input
                      value={formData.postalCode}
                      onChange={(e) => handleChange('postalCode', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground">{t('contact') || 'Contact'}</h3>
                
                {/* Phone */}
                <div className="space-y-2">
                  <Label>{t('phone') || 'Téléphone'}</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.phonePrefix}
                      onValueChange={(value) => handleChange('phonePrefix', value)}
                    >
                      <SelectTrigger className="w-[140px]">
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
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="flex-1"
                      placeholder="12345678"
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.whatsappPrefix}
                      onValueChange={(value) => handleChange('whatsappPrefix', value)}
                    >
                      <SelectTrigger className="w-[140px]">
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
                      value={formData.whatsapp}
                      onChange={(e) => handleChange('whatsapp', e.target.value)}
                      className="flex-1"
                      placeholder="12345678"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label>{t('email') || 'Email'}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4">
              <Button 
                onClick={handleCreateNew} 
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t('create_and_continue') || 'Créer et continuer'}
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setMode('select_existing')}
                disabled={isSubmitting}
              >
                {t('use_existing_supplier') || 'Utiliser un fournisseur existant'}
              </Button>
              {matchedSupplier && (
                <Button 
                  variant="ghost" 
                  onClick={() => setMode('matched')}
                  disabled={isSubmitting}
                >
                  {t('back') || 'Retour'}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
