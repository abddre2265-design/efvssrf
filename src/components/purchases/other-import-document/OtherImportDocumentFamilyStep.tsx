import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Tags, FileText, FolderOpen } from 'lucide-react';
import { OtherImportDocumentData } from './types';

interface DocumentFamily {
  id: string;
  name: string;
  description: string | null;
}

interface OtherImportDocumentFamilyStepProps {
  documentCategory: string;
  importFolderNumber: string;
  originalFilename: string;
  organizationId: string;
  onValidate: (data: OtherImportDocumentData) => void;
  onCancel: () => void;
}

const DOCUMENT_CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  facture_commerciale_etrangere: { fr: 'Facture commerciale étrangère', en: 'Foreign commercial invoice' },
  facture_locale: { fr: 'Facture locale', en: 'Local invoice' },
  quittance_douaniere: { fr: 'Quittance douanière', en: 'Customs receipt' },
  autre: { fr: 'Autre document', en: 'Other document' },
};

export const OtherImportDocumentFamilyStep: React.FC<OtherImportDocumentFamilyStepProps> = ({
  documentCategory,
  importFolderNumber,
  originalFilename,
  organizationId,
  onValidate,
  onCancel,
}) => {
  const { language, isRTL } = useLanguage();
  const [families, setFamilies] = useState<DocumentFamily[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  const isFr = language === 'fr';

  useEffect(() => {
    const fetchFamilies = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('document_families')
          .select('id, name, description')
          .eq('organization_id', organizationId)
          .order('name');

        if (error) throw error;
        setFamilies(data || []);
      } catch (error) {
        console.error('Error fetching families:', error);
        toast.error(isFr ? 'Erreur lors du chargement des familles' : 'Error loading families');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFamilies();
  }, [organizationId, isFr]);

  const handleValidate = async () => {
    if (!selectedFamilyId) {
      toast.error(isFr ? 'Veuillez sélectionner une famille de document' : 'Please select a document family');
      return;
    }

    setIsValidating(true);
    try {
      onValidate({
        documentCategory,
        documentFamilyId: selectedFamilyId,
        notes: notes.trim() || undefined,
      });
    } catch (error) {
      console.error('Error validating:', error);
      toast.error(isFr ? 'Erreur lors de la validation' : 'Error during validation');
    } finally {
      setIsValidating(false);
    }
  };

  const getCategoryLabel = () => {
    const labels = DOCUMENT_CATEGORY_LABELS[documentCategory];
    return labels ? labels[language as keyof typeof labels] : documentCategory;
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            {isFr ? 'Sélection de la famille' : 'Family Selection'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Document info summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{isFr ? 'Fichier' : 'File'}</p>
                <p className="font-medium text-sm truncate max-w-[200px]">{originalFilename}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{isFr ? 'Dossier' : 'Folder'}</p>
                <p className="font-mono font-medium">#{importFolderNumber}</p>
              </div>
            </div>
          </div>

          {/* Category display */}
          <div className="space-y-2">
            <Label>{isFr ? 'Catégorie du document' : 'Document Category'}</Label>
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="font-medium text-primary">{getCategoryLabel()}</p>
            </div>
          </div>

          {/* Family selection */}
          <div className="space-y-2">
            <Label htmlFor="family">
              {isFr ? 'Famille de document' : 'Document Family'} *
            </Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : families.length === 0 ? (
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-200">
                <p className="text-amber-700 text-sm">
                  {isFr 
                    ? 'Aucune famille de document configurée. Veuillez créer une famille dans les paramètres.' 
                    : 'No document families configured. Please create a family in settings.'}
                </p>
              </div>
            ) : (
              <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
                <SelectTrigger id="family">
                  <SelectValue placeholder={isFr ? 'Sélectionner une famille' : 'Select a family'} />
                </SelectTrigger>
                <SelectContent>
                  {families.map((family) => (
                    <SelectItem key={family.id} value={family.id}>
                      <div>
                        <span className="font-medium">{family.name}</span>
                        {family.description && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({family.description})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{isFr ? 'Notes (optionnel)' : 'Notes (optional)'}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isFr ? 'Ajouter des notes...' : 'Add notes...'}
              rows={3}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleValidate} 
              disabled={!selectedFamilyId || isValidating || families.length === 0}
              className="flex-1"
            >
              {isValidating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isFr ? 'Valider' : 'Validate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
