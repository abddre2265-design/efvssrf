import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Building2, User as UserIcon, Upload, Link as LinkIcon, Plus, Trash2, Image, XCircle, Loader2 } from 'lucide-react';
import { useLanguage, governorates } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BankInfo {
  id: string;
  bankName: string;
  iban: string;
  isNew?: boolean;
}

interface OrganizationData {
  id?: string;
  type: 'legal' | 'individual';
  name: string;
  identifier: string;
  identifierType: 'taxId' | 'cin' | 'passport';
  email: string;
  phone: string;
  address: string;
  city: string;
  governorate: string;
  postalCode: string;
  banks: BankInfo[];
  logoUrl: string;
  logoFile: File | null;
  logoPreview: string;
  isIdentifierLocked: boolean;
}

export const OrganizationSettingsDialog: React.FC = () => {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoTab, setLogoTab] = useState<'upload' | 'url'>('upload');
  const [data, setData] = useState<OrganizationData>({
    type: 'legal',
    name: '',
    identifier: '',
    identifierType: 'taxId',
    email: '',
    phone: '',
    address: '',
    city: '',
    governorate: '',
    postalCode: '',
    banks: [{ id: 'new-1', bankName: '', iban: '', isNew: true }],
    logoUrl: '',
    logoFile: null,
    logoPreview: '',
    isIdentifierLocked: false,
  });

  // Load organization data when dialog opens
  useEffect(() => {
    if (open) {
      loadOrganizationData();
    }
  }, [open]);

  const loadOrganizationData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (orgError) throw orgError;

      if (org) {
        // Load banks
        const { data: banks, error: banksError } = await supabase
          .from('organization_banks')
          .select('*')
          .eq('organization_id', org.id);

        if (banksError) throw banksError;

        setData({
          id: org.id,
          type: org.org_type as 'legal' | 'individual',
          name: org.name,
          identifier: org.identifier || '',
          identifierType: (org.identifier_type as 'taxId' | 'cin' | 'passport') || 'taxId',
          email: org.email || '',
          phone: org.phone,
          address: org.address || '',
          city: org.city || '',
          governorate: org.governorate,
          postalCode: org.postal_code,
          banks: banks && banks.length > 0 
            ? banks.map(b => ({ id: b.id, bankName: b.bank_name || '', iban: b.iban }))
            : [{ id: 'new-1', bankName: '', iban: '', isNew: true }],
          logoUrl: org.logo_url || '',
          logoFile: null,
          logoPreview: org.logo_url || '',
          isIdentifierLocked: org.identifier_locked,
        });
      }
    } catch (error) {
      console.error('Error loading organization:', error);
      toast.error(t('genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const taxIdPatterns = [
    /^\d{7}\/F$/,
    /^\d{6}\/[A-Z]$/,
    /^\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}$/,
    /^\d{6}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}$/,
  ];

  const validateTaxId = (value: string): boolean => {
    return taxIdPatterns.some(pattern => pattern.test(value));
  };

  const validateCin = (value: string): boolean => {
    return /^\d{8}$/.test(value);
  };

  const validateIban = (value: string): boolean => {
    const cleanIban = value.replace(/\s/g, '');
    return /^TN\d{2}\d{20}$/.test(cleanIban);
  };

  const validatePostalCode = (value: string): boolean => {
    return /^\d{4}$/.test(value);
  };

  const handleAddBank = () => {
    setData(prev => ({
      ...prev,
      banks: [...prev.banks, { id: `new-${Date.now()}`, bankName: '', iban: '', isNew: true }],
    }));
  };

  const handleRemoveBank = (id: string) => {
    if (data.banks.length > 1) {
      setData(prev => ({
        ...prev,
        banks: prev.banks.filter(b => b.id !== id),
      }));
    }
  };

  const handleBankChange = (id: string, field: 'bankName' | 'iban', value: string) => {
    setData(prev => ({
      ...prev,
      banks: prev.banks.map(b => (b.id === id ? { ...b, [field]: value } : b)),
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        toast.error(t('invalidFileFormat'));
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('fileTooLarge'));
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setData(prev => ({
        ...prev,
        logoFile: file,
        logoPreview: previewUrl,
        logoUrl: '',
      }));
      toast.success(t('logoUploaded'));
    }
  };

  const handleUrlChange = (url: string) => {
    setData(prev => ({
      ...prev,
      logoUrl: url,
      logoFile: null,
      logoPreview: url,
    }));
  };

  const handleRemoveLogo = () => {
    if (data.logoPreview && data.logoFile) {
      URL.revokeObjectURL(data.logoPreview);
    }
    setData(prev => ({
      ...prev,
      logoFile: null,
      logoUrl: '',
      logoPreview: '',
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUrlPreview = () => {
    if (data.logoUrl) {
      setData(prev => ({ ...prev, logoPreview: data.logoUrl }));
    }
  };

  const uploadLogo = async (userId: string): Promise<string | null> => {
    if (!data.logoFile) return data.logoUrl || null;

    const fileExt = data.logoFile.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('organization-logos')
      .upload(fileName, data.logoFile, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data: publicUrl } = supabase.storage
      .from('organization-logos')
      .getPublicUrl(fileName);

    return publicUrl.publicUrl;
  };

  const handleSave = async () => {
    // Validate required fields
    if (!data.name || !data.phone || !data.governorate || !data.postalCode) {
      toast.error(t('required'));
      return;
    }

    // Validate identifier if provided
    if (data.identifier) {
      if (data.identifierType === 'taxId' && !validateTaxId(data.identifier)) {
        toast.error(t('invalidTaxId'));
        return;
      }
      if (data.identifierType === 'cin' && !validateCin(data.identifier)) {
        toast.error(t('invalidCin'));
        return;
      }
    }

    // Validate postal code
    if (!validatePostalCode(data.postalCode)) {
      toast.error(t('invalidPostalCode'));
      return;
    }

    // Validate IBAN for all banks with values
    for (const bank of data.banks) {
      if (bank.iban && !validateIban(bank.iban)) {
        toast.error(t('invalidIban'));
        return;
      }
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload logo if file selected
      let logoUrl = data.logoUrl;
      if (data.logoFile) {
        logoUrl = await uploadLogo(user.id) || '';
      }

      const orgData = {
        user_id: user.id,
        org_type: data.type,
        name: data.name,
        identifier: data.identifier || null,
        identifier_type: data.identifierType,
        identifier_locked: data.identifier ? true : false,
        email: data.email || null,
        phone: data.phone,
        address: data.address || null,
        city: data.city || null,
        governorate: data.governorate,
        postal_code: data.postalCode,
        logo_url: logoUrl || null,
      };

      let organizationId = data.id;

      if (data.id) {
        // Update existing organization
        const updateData = { ...orgData };
        if (data.isIdentifierLocked) {
          // Don't update identifier if locked
          delete (updateData as any).identifier;
          delete (updateData as any).identifier_type;
          delete (updateData as any).identifier_locked;
        }
        delete (updateData as any).user_id;

        const { error } = await supabase
          .from('organizations')
          .update(updateData)
          .eq('id', data.id);

        if (error) throw error;
      } else {
        // Create new organization
        const { data: newOrg, error } = await supabase
          .from('organizations')
          .insert(orgData)
          .select()
          .single();

        if (error) throw error;
        organizationId = newOrg.id;
      }

      // Handle banks
      if (organizationId) {
        // Get existing bank IDs
        const existingBankIds = data.banks.filter(b => !b.isNew).map(b => b.id);
        
        // Delete banks that were removed
        if (data.id) {
          const { error: deleteError } = await supabase
            .from('organization_banks')
            .delete()
            .eq('organization_id', organizationId)
            .not('id', 'in', `(${existingBankIds.join(',')})`);

          if (deleteError && existingBankIds.length > 0) {
            console.error('Delete error:', deleteError);
          }
        }

        // Upsert banks
        for (const bank of data.banks) {
          if (bank.iban) {
            if (bank.isNew) {
              const { error } = await supabase
                .from('organization_banks')
                .insert({
                  organization_id: organizationId,
                  bank_name: bank.bankName || null,
                  iban: bank.iban,
                });
              if (error) console.error('Bank insert error:', error);
            } else {
              const { error } = await supabase
                .from('organization_banks')
                .update({
                  bank_name: bank.bankName || null,
                  iban: bank.iban,
                })
                .eq('id', bank.id);
              if (error) console.error('Bank update error:', error);
            }
          }
        }
      }

      // Update local state
      setData(prev => ({ 
        ...prev, 
        id: organizationId,
        isIdentifierLocked: prev.identifier ? true : prev.isIdentifierLocked,
        logoUrl: logoUrl || '',
        logoPreview: logoUrl || '',
        logoFile: null,
      }));

      toast.success(t('settingsSaved'));
      setOpen(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('genericError'));
    } finally {
      setIsSaving(false);
    }
  };

  const getGovernorateName = (gov: typeof governorates[0]) => {
    return gov[language] || gov.fr;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-accent/50 hover:border-primary/50 transition-all duration-300"
        >
          <motion.div
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.3 }}
          >
            <Settings className="h-5 w-5" />
          </motion.div>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 glass-strong">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl gradient-text">{t('organizationDetails')}</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[70vh] px-6 pb-6">
            <div className="space-y-6 py-4">
              {/* Organization Type */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">{t('organizationType')}</Label>
                <RadioGroup
                  value={data.type}
                  onValueChange={(value: 'legal' | 'individual') => setData(prev => ({ ...prev, type: value }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="legal" id="legal" />
                    <Label htmlFor="legal" className="flex items-center gap-2 cursor-pointer">
                      <Building2 className="w-4 h-4" />
                      {t('legalEntity')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="individual" id="individual" />
                    <Label htmlFor="individual" className="flex items-center gap-2 cursor-pointer">
                      <UserIcon className="w-4 h-4" />
                      {t('individual')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* Name */}
              <div className="space-y-2">
                <Label>{data.type === 'legal' ? t('companyName') : t('fullName')} *</Label>
                <Input
                  value={data.name}
                  onChange={(e) => setData(prev => ({ ...prev, name: e.target.value }))}
                  className="futuristic-input"
                  placeholder={data.type === 'legal' ? 'SARL Example' : 'Mohamed Ben Ali'}
                />
              </div>

              {/* Identifier */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('identifier')}</Label>
                  {data.isIdentifierLocked && (
                    <span className="text-xs text-amber-500">{t('identifierLocked')}</span>
                  )}
                </div>
                
                {data.type === 'individual' && (
                  <RadioGroup
                    value={data.identifierType}
                    onValueChange={(value: 'taxId' | 'cin' | 'passport') => 
                      setData(prev => ({ ...prev, identifierType: value, identifier: '' }))
                    }
                    className="flex gap-3 mb-2"
                    disabled={data.isIdentifierLocked}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="taxId" id="taxId" />
                      <Label htmlFor="taxId" className="text-sm cursor-pointer">{t('taxId')}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cin" id="cin" />
                      <Label htmlFor="cin" className="text-sm cursor-pointer">{t('cin')}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="passport" id="passport" />
                      <Label htmlFor="passport" className="text-sm cursor-pointer">{t('passport')}</Label>
                    </div>
                  </RadioGroup>
                )}
                
                <Input
                  value={data.identifier}
                  onChange={(e) => setData(prev => ({ ...prev, identifier: e.target.value }))}
                  className="futuristic-input"
                  disabled={data.isIdentifierLocked}
                  placeholder={
                    data.identifierType === 'cin' ? '12345678' :
                    data.identifierType === 'passport' ? 'AB123456' :
                    '1234567/F'
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {data.identifierType === 'taxId' && 'Formats: NNNNNNN/F, NNNNNN/X, NNNNNNNX/X/X/NNN'}
                  {data.identifierType === 'cin' && '8 chiffres'}
                  {data.identifierType === 'passport' && 'Combinaison alphanumérique'}
                </p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input
                  type="email"
                  value={data.email}
                  onChange={(e) => setData(prev => ({ ...prev, email: e.target.value }))}
                  className="futuristic-input"
                  placeholder="contact@example.com"
                />
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold">{t('contactInfo')}</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('phone')} *</Label>
                    <Input
                      value={data.phone}
                      onChange={(e) => setData(prev => ({ ...prev, phone: e.target.value }))}
                      className="futuristic-input"
                      placeholder="+216 XX XXX XXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('postalCode')} *</Label>
                    <Input
                      value={data.postalCode}
                      onChange={(e) => setData(prev => ({ ...prev, postalCode: e.target.value }))}
                      className="futuristic-input"
                      placeholder="1000"
                      maxLength={4}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('address')} ({t('optional')})</Label>
                  <Input
                    value={data.address}
                    onChange={(e) => setData(prev => ({ ...prev, address: e.target.value }))}
                    className="futuristic-input"
                    placeholder="123 Rue Example"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('city')} ({t('optional')})</Label>
                    <Input
                      value={data.city}
                      onChange={(e) => setData(prev => ({ ...prev, city: e.target.value }))}
                      className="futuristic-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('governorate')} *</Label>
                    <Select
                      value={data.governorate}
                      onValueChange={(value) => setData(prev => ({ ...prev, governorate: value }))}
                    >
                      <SelectTrigger className="futuristic-input">
                        <SelectValue placeholder={t('selectGovernorate')} />
                      </SelectTrigger>
                      <SelectContent>
                        {governorates.map((gov) => (
                          <SelectItem key={gov.value} value={gov.value}>
                            {getGovernorateName(gov)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('country')}</Label>
                  <Input
                    value={t('tunisia')}
                    disabled
                    className="futuristic-input bg-muted/50"
                  />
                </div>
              </div>

              <Separator />

              {/* Bank Info */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold">{t('bankInfo')}</h3>
                
                <AnimatePresence>
                  {data.banks.map((bank, index) => (
                    <motion.div
                      key={bank.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {t('bankName')} {index + 1}
                        </span>
                        {data.banks.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveBank(bank.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">{t('bankName')} ({t('optional')})</Label>
                          <Input
                            value={bank.bankName}
                            onChange={(e) => handleBankChange(bank.id, 'bankName', e.target.value)}
                            className="futuristic-input"
                            placeholder="BIAT, STB, ..."
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t('iban')} *</Label>
                          <Input
                            value={bank.iban}
                            onChange={(e) => handleBankChange(bank.id, 'iban', e.target.value)}
                            className="futuristic-input"
                            placeholder="TN59 0711 1015 8101 1006 7785"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddBank}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('addBank')}
                </Button>
              </div>

              <Separator />

              {/* Logo */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold">{t('organizationLogo')}</h3>
                
                {/* Logo Preview */}
                {data.logoPreview && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative mx-auto w-32 h-32 rounded-xl overflow-hidden border-2 border-primary/50 bg-muted/30 group"
                  >
                    <img
                      src={data.logoPreview}
                      alt="Logo preview"
                      className="w-full h-full object-contain"
                      onError={() => {
                        toast.error(t('imageLoadError'));
                        setData(prev => ({ ...prev, logoPreview: '' }));
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleRemoveLogo}
                      className="absolute top-1 right-1 p-1 rounded-full bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XCircle className="w-5 h-5" />
                    </motion.button>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                  </motion.div>
                )}

                <Tabs value={logoTab} onValueChange={(v) => setLogoTab(v as 'upload' | 'url')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                    <TabsTrigger value="upload" className="gap-2">
                      <Upload className="w-4 h-4" />
                      {t('uploadLogo')}
                    </TabsTrigger>
                    <TabsTrigger value="url" className="gap-2">
                      <LinkIcon className="w-4 h-4" />
                      {t('enterUrl')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="space-y-3 mt-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all duration-300"
                    >
                      <div className="p-3 rounded-full bg-primary/10 mb-3">
                        <Image className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-sm font-medium">{t('clickToUpload')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('supportedFormats')}</p>
                      <p className="text-xs text-muted-foreground">{t('maxFileSize')}</p>
                    </motion.div>
                  </TabsContent>

                  <TabsContent value="url" className="space-y-3 mt-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        {t('imageUrl')}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={data.logoUrl}
                          onChange={(e) => handleUrlChange(e.target.value)}
                          className="futuristic-input flex-1"
                          placeholder="https://example.com/logo.png"
                        />
                        <Button
                          variant="outline"
                          onClick={handleUrlPreview}
                          disabled={!data.logoUrl}
                          className="shrink-0"
                        >
                          {t('preview')}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('supportedFormats')}</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-3 p-6 pt-0 border-t border-border/50">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} className="glow-primary" disabled={isLoading || isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {t('save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};