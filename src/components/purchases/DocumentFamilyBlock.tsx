import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Tags, 
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Plus
} from 'lucide-react';
import { DocumentFamily } from './types';

interface DocumentFamilyBlockProps {
  families: DocumentFamily[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const DocumentFamilyBlock: React.FC<DocumentFamilyBlockProps> = ({
  families,
  isLoading,
  onRefresh,
}) => {
  const { t, isRTL } = useLanguage();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<DocumentFamily | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [familyDocuments, setFamilyDocuments] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setName('');
    setDescription('');
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('name_required'));
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
        .from('document_families')
        .insert({
          organization_id: org.id,
          name: name.trim(),
          description: description.trim() || null,
        });

      if (error) throw error;

      toast.success(t('family_created'));
      resetForm();
      setIsCreateOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Error creating family:', error);
      toast.error(t('error_creating_family'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedFamily || !name.trim()) {
      toast.error(t('name_required'));
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('document_families')
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq('id', selectedFamily.id);

      if (error) throw error;

      toast.success(t('family_updated'));
      resetForm();
      setIsEditOpen(false);
      setSelectedFamily(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating family:', error);
      toast.error(t('error_updating_family'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (family: DocumentFamily) => {
    try {
      // Check if family has documents
      const { data: docs } = await supabase
        .from('purchase_documents')
        .select('id')
        .eq('document_family_id', family.id)
        .limit(1);

      if (docs && docs.length > 0) {
        toast.error(t('family_has_documents'));
        return;
      }

      const { error } = await supabase
        .from('document_families')
        .delete()
        .eq('id', family.id);

      if (error) throw error;

      toast.success(t('family_deleted'));
      onRefresh();
    } catch (error) {
      console.error('Error deleting family:', error);
      toast.error(t('error_deleting_family'));
    }
  };

  const openEdit = (family: DocumentFamily) => {
    setSelectedFamily(family);
    setName(family.name);
    setDescription(family.description || '');
    setIsEditOpen(true);
  };

  const handleView = async (family: DocumentFamily) => {
    setSelectedFamily(family);
    setIsViewOpen(true);
    setIsLoadingDocs(true);

    try {
      const { data, error } = await supabase
        .from('purchase_documents')
        .select('id, invoice_number, invoice_date, status, net_payable, currency')
        .eq('document_family_id', family.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFamilyDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error(t('error_loading_documents'));
    } finally {
      setIsLoadingDocs(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            {t('document_families')}
          </CardTitle>
          <CardDescription>{t('document_families_description')}</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('create_family')}
            </Button>
          </DialogTrigger>
          <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                {t('create_document_family')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="family-name">{t('family_name')} *</Label>
                <Input
                  id="family-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('family_name_placeholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="family-description">{t('description')}</Label>
                <Textarea
                  id="family-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('family_description_placeholder')}
                  rows={3}
                />
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
        ) : families.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Tags className="h-12 w-12 mb-4" />
            <p>{t('no_document_families')}</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead className="w-[60px]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {families.map((family) => (
                  <TableRow key={family.id}>
                    <TableCell className="font-medium">{family.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {family.description || '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-popover">
                          <DropdownMenuItem onClick={() => handleView(family)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(family)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(family)}
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

      {/* Edit Family Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              {t('edit_family')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-family-name">{t('family_name')} *</Label>
              <Input
                id="edit-family-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-family-description">{t('description')}</Label>
              <Textarea
                id="edit-family-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Family Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              {selectedFamily?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedFamily && (
            <div className="space-y-4">
              {selectedFamily.description && (
                <p className="text-muted-foreground">{selectedFamily.description}</p>
              )}

              <div className="space-y-2">
                <h4 className="font-medium">{t('assigned_documents')}</h4>
                {isLoadingDocs ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : familyDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t('no_documents_in_family')}
                  </p>
                ) : (
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-2">
                      {familyDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3 rounded-lg border bg-card text-sm flex items-center justify-between"
                        >
                          <div>
                            <span className="font-medium font-mono">
                              {doc.invoice_number || t('no_number')}
                            </span>
                            {doc.invoice_date && (
                              <span className="text-muted-foreground ml-2">
                                {new Date(doc.invoice_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {doc.net_payable?.toFixed(2)} {doc.currency}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {t(`status_${doc.status}`)}
                            </Badge>
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
