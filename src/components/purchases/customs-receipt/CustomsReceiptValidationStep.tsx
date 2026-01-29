import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { CheckCircle2, FileCheck, Building2, Calendar, Hash, DollarSign, FileText } from 'lucide-react';
import { CustomsReceiptData, QUITTANCE_TYPES } from './types';

interface CustomsReceiptValidationStepProps {
  extractedData: CustomsReceiptData;
  importFolderNumber: string;
  onValidate: (validatedData: CustomsReceiptData) => void;
}

export const CustomsReceiptValidationStep: React.FC<CustomsReceiptValidationStepProps> = ({
  extractedData,
  importFolderNumber,
  onValidate,
}) => {
  const { language, isRTL } = useLanguage();
  const [formData, setFormData] = useState<CustomsReceiptData>(extractedData);

  const isFr = language === 'fr';

  const handleChange = (field: keyof CustomsReceiptData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onValidate(formData);
  };

  const isValid = formData.documentNumber.trim() !== '' && formData.totalAmount > 0;

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            {isFr ? 'Validation des données' : 'Data Validation'}
          </CardTitle>
          <CardDescription>
            {isFr 
              ? `Vérifiez et modifiez les informations avant validation. Dossier d'importation: #${importFolderNumber}` 
              : `Verify and edit the information before validation. Import folder: #${importFolderNumber}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quittance Type */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {isFr ? 'Type de quittance' : 'Receipt type'}
              </Label>
              <Select
                value={formData.quittanceType}
                onValueChange={(value) => handleChange('quittanceType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUITTANCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {isFr ? type.labelFr : type.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customs Office */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {isFr ? 'Bureau des douanes' : 'Customs office'}
                </Label>
                <Input
                  value={formData.customsOffice}
                  onChange={(e) => handleChange('customsOffice', e.target.value)}
                  placeholder={isFr ? 'Ex: Rades Port' : 'Ex: Rades Port'}
                />
              </div>

              {/* Document Number */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  {isFr ? 'N° Quittance' : 'Receipt number'} *
                </Label>
                <Input
                  value={formData.documentNumber}
                  onChange={(e) => handleChange('documentNumber', e.target.value)}
                  placeholder="XXXXXXXXX"
                  required
                />
              </div>

              {/* Document Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {isFr ? 'Date de quittance' : 'Receipt date'}
                </Label>
                <Input
                  type="date"
                  value={formData.documentDate}
                  onChange={(e) => handleChange('documentDate', e.target.value)}
                />
              </div>

              {/* Total Amount */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {isFr ? 'Montant total (TND)' : 'Total amount (TND)'} *
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.totalAmount}
                  onChange={(e) => handleChange('totalAmount', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              {/* Customs Declaration Number */}
              <div className="space-y-2">
                <Label>
                  {isFr ? 'N° Déclaration douanière' : 'Customs declaration number'}
                </Label>
                <Input
                  value={formData.customsDeclarationNumber}
                  onChange={(e) => handleChange('customsDeclarationNumber', e.target.value)}
                  placeholder={isFr ? 'Si applicable' : 'If applicable'}
                />
              </div>

              {/* Importer Name */}
              <div className="space-y-2">
                <Label>
                  {isFr ? 'Raison sociale importateur' : 'Importer name'}
                </Label>
                <Input
                  value={formData.importerName}
                  onChange={(e) => handleChange('importerName', e.target.value)}
                  placeholder={isFr ? 'Nom de l\'entreprise' : 'Company name'}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{isFr ? 'Notes' : 'Notes'}</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder={isFr ? 'Notes optionnelles...' : 'Optional notes...'}
                rows={3}
              />
            </div>

            {/* Summary */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">{isFr ? 'Montant à payer' : 'Amount to pay'}</span>
                <span className="text-2xl font-bold text-primary">
                  {formData.totalAmount.toLocaleString('fr-TN', {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })} TND
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full gap-2" disabled={!isValid}>
              <CheckCircle2 className="h-4 w-4" />
              {isFr ? 'Valider et créer la quittance' : 'Validate and create receipt'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
