import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { StoreFormData } from './types';
import { MapPin, ExternalLink } from 'lucide-react';

interface StoreFormProps {
  formData: StoreFormData;
  setFormData: React.Dispatch<React.SetStateAction<StoreFormData>>;
}

const tunisiaGovernorates = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
  'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba',
  'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana',
  'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
];

export const StoreForm: React.FC<StoreFormProps> = ({ formData, setFormData }) => {
  const { t, isRTL } = useLanguage();

  const handleChange = (field: keyof StoreFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      {/* Store Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          {t('storeName')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder={t('storeNamePlaceholder')}
          className={isRTL ? 'text-right' : ''}
        />
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address" className="text-sm font-medium">
          {t('address')}
        </Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder={t('addressPlaceholder')}
          className={isRTL ? 'text-right' : ''}
        />
      </div>

      {/* City and Governorate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city" className="text-sm font-medium">
            {t('city')}
          </Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder={t('cityPlaceholder')}
            className={isRTL ? 'text-right' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="governorate" className="text-sm font-medium">
            {t('governorate')}
          </Label>
          <Select value={formData.governorate} onValueChange={(value) => handleChange('governorate', value)}>
            <SelectTrigger className={isRTL ? 'text-right' : ''}>
              <SelectValue placeholder={t('selectGovernorate')} />
            </SelectTrigger>
            <SelectContent>
              {tunisiaGovernorates.map(gov => (
                <SelectItem key={gov} value={gov}>{gov}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Postal Code and Country */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postal_code" className="text-sm font-medium">
            {t('postalCode')}
          </Label>
          <Input
            id="postal_code"
            value={formData.postal_code}
            onChange={(e) => handleChange('postal_code', e.target.value)}
            placeholder="1000"
            maxLength={4}
            className={isRTL ? 'text-right' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country" className="text-sm font-medium">
            {t('country')}
          </Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => handleChange('country', e.target.value)}
            placeholder={t('tunisia')}
            className={isRTL ? 'text-right' : ''}
          />
        </div>
      </div>

      {/* Phone and Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            {t('phone')}
          </Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="+216 XX XXX XXX"
            className={isRTL ? 'text-right' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            {t('email')}
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="contact@store.com"
            className={isRTL ? 'text-right' : ''}
          />
        </div>
      </div>

      {/* Google Maps Link */}
      <div className="space-y-2">
        <Label htmlFor="google_maps_link" className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          {t('googleMapsLink')}
          <span className="text-muted-foreground text-xs">({t('optional')})</span>
        </Label>
        <div className="relative">
          <Input
            id="google_maps_link"
            value={formData.google_maps_link}
            onChange={(e) => handleChange('google_maps_link', e.target.value)}
            placeholder="https://maps.google.com/..."
            className={`${isRTL ? 'text-right pr-10' : 'pr-10'}`}
          />
          {formData.google_maps_link && (
            <a
              href={formData.google_maps_link}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
