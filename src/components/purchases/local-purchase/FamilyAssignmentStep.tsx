import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Tags, 
  Plus,
  CheckCircle2,
  Loader2,
  ChevronRight,
  FolderOpen
} from 'lucide-react';
import { DocumentFamily } from '@/components/purchases/types';

interface FamilyAssignmentStepProps {
  organizationId: string;
  onFamilyConfirmed: (familyId: string | null, familyName: string | null) => void;
}

export const FamilyAssignmentStep: React.FC<FamilyAssignmentStepProps> = ({
  organizationId,
  onFamilyConfirmed,
}) => {
  const { t, isRTL } = useLanguage();
  const [families, setFamilies] = useState<DocumentFamily[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('none');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // New family form
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyDescription, setNewFamilyDescription] = useState('');

  // Load families
  useEffect(() => {
    const loadFamilies = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('document_families')
          .select('*')
          .eq('organization_id', organizationId)
          .order('name', { ascending: true });

        if (error) throw error;
        setFamilies(data || []);
      } catch (error) {
        console.error('Error loading families:', error);
        toast.error('Erreur de chargement des familles');
      } finally {
        setIsLoading(false);
      }
    };

    loadFamilies();
  }, [organizationId]);

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim()) {
      toast.error('Le nom de la famille est requis');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('document_families')
        .insert({
          organization_id: organizationId,
          name: newFamilyName.trim(),
          description: newFamilyDescription.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to list and select it
      setFamilies(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedFamilyId(data.id);
      setIsCreateDialogOpen(false);
      setNewFamilyName('');
      setNewFamilyDescription('');
      
      toast.success('Famille créée et sélectionnée');
    } catch (error) {
      console.error('Error creating family:', error);
      toast.error('Erreur lors de la création de la famille');
    } finally {
      setIsCreating(false);
    }
  };

  const handleContinue = () => {
    const familyId = selectedFamilyId === 'none' ? null : selectedFamilyId;
    const familyName = familyId 
      ? families.find(f => f.id === familyId)?.name || null 
      : null;
    onFamilyConfirmed(familyId, familyName);
  };

  const selectedFamily = families.find(f => f.id === selectedFamilyId);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Assignation de famille
          </CardTitle>
          <CardDescription>
            Assignez ce document à une famille pour une meilleure organisation (optionnel)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Family Selection */}
              <div className="space-y-3">
                <Label>Famille de document</Label>
                <div className="flex gap-2">
                  <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Sélectionner une famille..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Aucune famille</span>
                      </SelectItem>
                      {families.map(family => (
                        <SelectItem key={family.id} value={family.id}>
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            {family.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Créer
                  </Button>
                </div>
              </div>

              {/* Selected Family Info */}
              {selectedFamily && (
                <div className="p-4 border rounded-lg bg-primary/5 border-primary/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="font-medium text-primary">{selectedFamily.name}</span>
                  </div>
                  {selectedFamily.description && (
                    <p className="text-sm text-muted-foreground">{selectedFamily.description}</p>
                  )}
                </div>
              )}

              {/* Available Families Preview */}
              {families.length > 0 && selectedFamilyId === 'none' && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Familles disponibles :</p>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-1">
                      {families.map(family => (
                        <div
                          key={family.id}
                          className="p-2 rounded-md hover:bg-muted cursor-pointer flex items-center justify-between"
                          onClick={() => setSelectedFamilyId(family.id)}
                        >
                          <div className="flex items-center gap-2">
                            <Tags className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{family.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            Sélectionner
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {families.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Tags className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune famille de document créée</p>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="mt-4 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Créer une famille
                  </Button>
                </div>
              )}

              {/* Continue Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleContinue} className="gap-2">
                  Continuer
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Family Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Créer une famille de document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="family-name">Nom de la famille *</Label>
              <Input
                id="family-name"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="Ex: Factures 2024, Électronique, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="family-description">Description (optionnel)</Label>
              <Textarea
                id="family-description"
                value={newFamilyDescription}
                onChange={(e) => setNewFamilyDescription(e.target.value)}
                placeholder="Description de cette famille de documents..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateFamily} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
