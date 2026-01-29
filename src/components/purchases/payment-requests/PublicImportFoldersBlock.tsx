import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  FolderOpen,
  Plus,
  Loader2,
  CheckCircle2,
  Lock,
  Globe,
} from 'lucide-react';
import { COUNTRIES, MONTHS } from '@/components/purchases/types';

interface ImportFolder {
  id: string;
  folder_number: string;
  folder_month: number;
  folder_year: number;
  country: string;
  status: string;
}

interface PublicImportFoldersBlockProps {
  organizationId: string;
}

export const PublicImportFoldersBlock: React.FC<PublicImportFoldersBlockProps> = ({
  organizationId,
}) => {
  const [folders, setFolders] = useState<ImportFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Create form state
  const [folderNumber, setFolderNumber] = useState('');
  const [folderMonth, setFolderMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [folderYear, setFolderYear] = useState<string>(String(new Date().getFullYear()));
  const [country, setCountry] = useState('CN');

  const fetchFolders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('import_folders')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFolders((data || []) as ImportFolder[]);
    } catch (error) {
      console.error('Error fetching import folders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchFolders();
    }
  }, [organizationId]);

  const handleCreate = async () => {
    if (!folderNumber.trim()) {
      toast.error('Le numéro de dossier est obligatoire');
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from('import_folders')
        .insert({
          organization_id: organizationId,
          folder_number: folderNumber.trim(),
          folder_month: parseInt(folderMonth),
          folder_year: parseInt(folderYear),
          country,
          status: 'open',
        });

      if (error) throw error;

      toast.success('Dossier d\'importation créé');
      setIsCreateDialogOpen(false);
      setFolderNumber('');
      fetchFolders();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Erreur lors de la création du dossier');
    } finally {
      setIsCreating(false);
    }
  };

  const getCountryName = (code: string) => {
    const countryObj = COUNTRIES.find(c => c.code === code);
    return countryObj?.name.fr || code;
  };

  const getMonthName = (month: number) => {
    const monthObj = MONTHS.find(m => m.value === month);
    return monthObj?.fr || month;
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Dossiers d'importation
            </span>
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nouveau
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun dossier d'importation</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="p-3 border rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-mono font-medium">{folder.folder_number}</div>
                        <div className="text-sm text-muted-foreground">
                          {getCountryName(folder.country)} - {getMonthName(folder.folder_month)} {folder.folder_year}
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={folder.status === 'open' 
                        ? 'bg-green-100 text-green-800 border-green-300' 
                        : 'bg-gray-100 text-gray-800 border-gray-300'
                      }
                    >
                      {folder.status === 'open' ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ouvert
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3 mr-1" />
                          Fermé
                        </>
                      )}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Nouveau dossier d'importation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Numéro de dossier *</Label>
              <Input
                value={folderNumber}
                onChange={(e) => setFolderNumber(e.target.value)}
                placeholder="Ex: 2024-001"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mois</Label>
                <Select value={folderMonth} onValueChange={setFolderMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.fr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Année</Label>
                <Select value={folderYear} onValueChange={setFolderYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pays d'origine</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name.fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !folderNumber.trim()}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
