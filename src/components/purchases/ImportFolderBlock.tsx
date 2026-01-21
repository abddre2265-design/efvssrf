import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  FolderPlus, 
  FolderOpen, 
  FolderClosed,
  MoreHorizontal,
  Eye,
  Lock,
  Trash2,
  Loader2,
  Plus
} from 'lucide-react';
import { ImportFolder, COUNTRIES, MONTHS } from './types';

interface ImportFolderBlockProps {
  folders: ImportFolder[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const ImportFolderBlock: React.FC<ImportFolderBlockProps> = ({
  folders,
  isLoading,
  onRefresh,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<ImportFolder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [folderLogs, setFolderLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Form state
  const [folderNumber, setFolderNumber] = useState('');
  const [folderMonth, setFolderMonth] = useState<string>('');
  const [folderYear, setFolderYear] = useState<string>(new Date().getFullYear().toString());
  const [country, setCountry] = useState<string>('');

  const resetForm = () => {
    setFolderNumber('');
    setFolderMonth('');
    setFolderYear(new Date().getFullYear().toString());
    setCountry('');
  };

  const handleCreate = async () => {
    if (!folderNumber.trim() || !folderMonth || !country) {
      toast.error(t('fill_required_fields'));
      return;
    }

    setIsSaving(true);
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .single();

      if (!org) throw new Error('Organization not found');

      const { error } = await supabase
        .from('import_folders')
        .insert({
          organization_id: org.id,
          folder_number: folderNumber.trim(),
          folder_month: parseInt(folderMonth),
          folder_year: parseInt(folderYear),
          country: country,
          status: 'open',
        });

      if (error) throw error;

      toast.success(t('import_folder_created'));
      resetForm();
      setIsCreateOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error(t('error_creating_folder'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async (folder: ImportFolder) => {
    try {
      const { error } = await supabase
        .from('import_folders')
        .update({ status: 'closed' })
        .eq('id', folder.id);

      if (error) throw error;

      // Add log entry
      await supabase.from('import_folder_logs').insert({
        import_folder_id: folder.id,
        action: 'closed',
        details: { closed_at: new Date().toISOString() },
      });

      toast.success(t('folder_closed_success'));
      onRefresh();
    } catch (error) {
      console.error('Error closing folder:', error);
      toast.error(t('error_closing_folder'));
    }
  };

  const handleDelete = async (folder: ImportFolder) => {
    try {
      // Check if folder has documents
      const { data: docs } = await supabase
        .from('purchase_documents')
        .select('id')
        .eq('import_folder_id', folder.id)
        .limit(1);

      if (docs && docs.length > 0) {
        toast.error(t('folder_not_empty'));
        return;
      }

      const { error } = await supabase
        .from('import_folders')
        .delete()
        .eq('id', folder.id);

      if (error) throw error;

      toast.success(t('folder_deleted'));
      onRefresh();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error(t('error_deleting_folder'));
    }
  };

  const handleView = async (folder: ImportFolder) => {
    setSelectedFolder(folder);
    setIsViewOpen(true);
    setIsLoadingLogs(true);

    try {
      const { data, error } = await supabase
        .from('import_folder_logs')
        .select('*')
        .eq('import_folder_id', folder.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFolderLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error(t('error_loading_logs'));
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const getCountryName = (code: string) => {
    const c = COUNTRIES.find(c => c.code === code);
    return c ? c.name[language as keyof typeof c.name] : code;
  };

  const getMonthName = (month: number) => {
    const m = MONTHS.find(m => m.value === month);
    return m ? m[language as keyof typeof m] : month.toString();
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {t('import_folders')}
          </CardTitle>
          <CardDescription>{t('import_folders_description')}</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('create_folder')}
            </Button>
          </DialogTrigger>
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5" />
                {t('create_import_folder')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="folder-number">{t('folder_number')} *</Label>
                <Input
                  id="folder-number"
                  value={folderNumber}
                  onChange={(e) => setFolderNumber(e.target.value)}
                  placeholder={t('folder_number_placeholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('month')} *</Label>
                  <Select value={folderMonth} onValueChange={setFolderMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_month')} />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month[language as keyof typeof month]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('year')} *</Label>
                  <Select value={folderYear} onValueChange={setFolderYear}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_year')} />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('country')} *</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_country')} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name[language as keyof typeof c.name]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mb-4" />
            <p>{t('no_import_folders')}</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('folder_number')}</TableHead>
                  <TableHead>{t('period')}</TableHead>
                  <TableHead>{t('country')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="w-[60px]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folders.map((folder) => (
                  <TableRow key={folder.id}>
                    <TableCell className="font-mono font-medium">
                      {folder.folder_number}
                    </TableCell>
                    <TableCell>
                      {getMonthName(folder.folder_month)} {folder.folder_year}
                    </TableCell>
                    <TableCell>{getCountryName(folder.country)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          folder.status === 'open'
                            ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                            : 'bg-gray-500/20 text-gray-700 dark:text-gray-400'
                        }
                      >
                        {folder.status === 'open' ? (
                          <FolderOpen className="h-3 w-3 mr-1" />
                        ) : (
                          <FolderClosed className="h-3 w-3 mr-1" />
                        )}
                        {t(`folder_${folder.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-popover">
                          <DropdownMenuItem onClick={() => handleView(folder)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('view')}
                          </DropdownMenuItem>
                          {folder.status === 'open' && (
                            <DropdownMenuItem onClick={() => handleClose(folder)}>
                              <Lock className="mr-2 h-4 w-4" />
                              {t('close_folder')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(folder)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* View Folder Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {t('folder_details')} - {selectedFolder?.folder_number}
            </DialogTitle>
          </DialogHeader>

          {selectedFolder && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{t('period')}</p>
                  <p className="font-medium">
                    {getMonthName(selectedFolder.folder_month)} {selectedFolder.folder_year}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{t('country')}</p>
                  <p className="font-medium">{getCountryName(selectedFolder.country)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{t('status')}</p>
                  <Badge
                    variant="secondary"
                    className={
                      selectedFolder.status === 'open'
                        ? 'bg-green-500/20 text-green-700'
                        : 'bg-gray-500/20 text-gray-700'
                    }
                  >
                    {t(`folder_${selectedFolder.status}`)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">{t('folder_history')}</h4>
                {isLoadingLogs ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : folderLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t('no_history')}
                  </p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {folderLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-lg border bg-card text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{t(log.action)}</span>
                            <span className="text-muted-foreground text-xs">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
