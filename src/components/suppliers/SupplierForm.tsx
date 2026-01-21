import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search } from 'lucide-react';
import {
  SupplierFormData,
  SupplierType,
  SUPPLIER_IDENTIFIER_TYPES,
  TUNISIA_GOVERNORATES,
  COUNTRY_PHONE_PREFIXES,
  COUNTRIES,
  getIdentifierValidation,
} from './types';

interface SupplierFormProps {
  initialData?: Partial<SupplierFormData>;
  onSubmit: (data: SupplierFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isEdit?: boolean;
  isDuplicate?: boolean;
}

export const SupplierForm: React.FC<SupplierFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEdit = false,
  isDuplicate = false,
}) => {
  const { t, isRTL } = useLanguage();
  const [countrySearch, setCountrySearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<SupplierFormData>({
    supplierType: initialData?.supplierType || 'individual_local',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    companyName: initialData?.companyName || '',
    identifierType: initialData?.identifierType || 'cin',
    identifierValue: initialData?.identifierValue || '',
    country: initialData?.country || 'Tunisie',
    governorate: initialData?.governorate || '',
    address: initialData?.address || '',
    postalCode: initialData?.postalCode || '',
    phonePrefix: initialData?.phonePrefix || '+216',
    phone: initialData?.phone || '',
    whatsappPrefix: initialData?.whatsappPrefix || '+216',
    whatsapp: initialData?.whatsapp || '',
    email: initialData?.email || '',
  });

  const isLocal = formData.supplierType !== 'foreign';
  const isIdentifierRequired = isLocal; // Only required for local suppliers

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
      if (!formData.firstName.trim()) newErrors.firstName = t('required');
      if (!formData.lastName.trim()) newErrors.lastName = t('required');
    } else if (formData.supplierType === 'business_local') {
      if (!formData.companyName.trim()) newErrors.companyName = t('required');
    } else if (formData.supplierType === 'foreign') {
      const hasName = formData.firstName.trim() && formData.lastName.trim();
      const hasCompany = formData.companyName.trim();
      if (!hasName && !hasCompany) {
        newErrors.companyName = t('name_or_company_required');
      }
    }

    // Identifier validation (only required for local)
    if (isIdentifierRequired) {
      if (!formData.identifierType) {
        newErrors.identifierType = t('required');
      }
      
      const identifierValidation = getIdentifierValidation(
        formData.identifierType, 
        formData.identifierValue, 
        true
      );
      if (!identifierValidation.valid && identifierValidation.message) {
        newErrors.identifierValue = t(identifierValidation.message);
      }
    } else if (formData.identifierValue) {
      // If foreign supplier has identifier, validate format
      const identifierValidation = getIdentifierValidation(
        formData.identifierType, 
        formData.identifierValue, 
        false
      );
      if (!identifierValidation.valid && identifierValidation.message) {
        newErrors.identifierValue = t(identifierValidation.message);
      }
    }

    // Governorate for local suppliers
    if (isLocal && !formData.governorate) {
      newErrors.governorate = t('required');
    }

    // Email validation if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('invalid_email');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const filteredCountries = COUNTRIES.filter(country =>
    country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Supplier Type */}
      <div className="space-y-2">
        <Label>{t('supplier_type')} *</Label>
        <Select
          value={formData.supplierType}
          onValueChange={(value: SupplierType) => handleChange('supplierType', value)}
          disabled={isEdit}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual_local">{t('individual_local')}</SelectItem>
            <SelectItem value="business_local">{t('business_local')}</SelectItem>
            <SelectItem value="foreign">{t('foreign_supplier')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Name Fields */}
      <div className="space-y-4">
        {formData.supplierType === 'individual_local' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('first_name')} *</Label>
              <Input
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className={errors.firstName ? 'border-destructive' : ''}
              />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('last_name')} *</Label>
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
            <Label>{t('company_name')} *</Label>
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
                <Label>{t('first_name')}</Label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('last_name')}</Label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('company_name')}</Label>
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
          <Label>{t('identifier_type')} {isIdentifierRequired && '*'}</Label>
          <Select
            value={formData.identifierType}
            onValueChange={(value) => handleChange('identifierType', value)}
            disabled={isEdit}
          >
            <SelectTrigger className={errors.identifierType ? 'border-destructive' : ''}>
              <SelectValue placeholder={t('select_identifier_type')} />
            </SelectTrigger>
            <SelectContent>
              {SUPPLIER_IDENTIFIER_TYPES[formData.supplierType].map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`identifier_${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.identifierType && <p className="text-xs text-destructive">{errors.identifierType}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('identifier_value')} {isIdentifierRequired && '*'}</Label>
          <Input
            value={formData.identifierValue}
            onChange={(e) => handleChange('identifierValue', e.target.value)}
            className={errors.identifierValue ? 'border-destructive' : ''}
            disabled={isEdit}
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
        <h3 className="font-medium text-sm text-muted-foreground">{t('address')}</h3>
        
        {/* Country */}
        <div className="space-y-2">
          <Label>{t('country')}</Label>
          {isLocal ? (
            <Input value="Tunisie" disabled className="bg-muted" />
          ) : (
            <Select
              value={formData.country}
              onValueChange={(value) => handleChange('country', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('select_country')} />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('search')}
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
            <Label>{t('governorate')} *</Label>
            <Select
              value={formData.governorate}
              onValueChange={(value) => handleChange('governorate', value)}
            >
              <SelectTrigger className={errors.governorate ? 'border-destructive' : ''}>
                <SelectValue placeholder={t('select_governorate')} />
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
            <Label>{t('address_line')}</Label>
            <Input
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('postal_code')}</Label>
            <Input
              value={formData.postalCode}
              onChange={(e) => handleChange('postalCode', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground">{t('contact')}</h3>
        
        {/* Phone */}
        <div className="space-y-2">
          <Label>{t('phone')}</Label>
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
          <Label>{t('email')}</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? t('save_changes') : t('create')}
        </Button>
      </div>
    </form>
  );
};
