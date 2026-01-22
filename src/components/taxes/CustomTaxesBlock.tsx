import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, AlertCircle, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { CustomTaxType, CustomTaxValue } from './types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface CustomTaxesBlockProps {
  customTaxes: CustomTaxType[];
  organizationId: string;
  onRefresh: () => void;
}

interface NewTaxForm {
  name: string;
  applicationType: 'add' | 'deduct';
  applicationOrder: 'before_stamp' | 'after_stamp';
  appliesToPayment: boolean;
  valueType: 'fixed' | 'percentage';
}

export const CustomTaxesBlock: React.FC<CustomTaxesBlockProps> = ({
  customTaxes,
  organizationId,
  onRefresh,
}) => {
  const { t, isRTL } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [expandedTaxes, setExpandedTaxes] = useState<Record<string, boolean>>({});
  const [newTax, setNewTax] = useState<NewTaxForm>({
    name: '',
    applicationType: 'add',
    applicationOrder: 'before_stamp',
    appliesToPayment: false,
    valueType: 'percentage',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTaxId, setDeletingTaxId] = useState<string | null>(null);
  const [deletingValueId, setDeletingValueId] = useState<string | null>(null);
  const [newValueInputs, setNewValueInputs] = useState<Record<string, { value: string; label: string }>>({});
  const [addingValueTo, setAddingValueTo] = useState<string | null>(null);

  const toggleExpanded = (taxId: string) => {
    setExpandedTaxes(prev => ({
      ...prev,
      [taxId]: !prev[taxId],
    }));
  };

  const handleCreateTax = async () => {
    if (!newTax.name.trim()) {
      toast.error(t('tax_name_required'));
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('custom_tax_types')
        .insert({
          organization_id: organizationId,
          name: newTax.name.trim(),
          application_type: newTax.applicationType,
          application_order: newTax.applicationOrder,
          applies_to_payment: newTax.appliesToPayment,
          value_type: newTax.valueType,
        });

      if (error) throw error;

      toast.success(t('custom_tax_created'));
      setNewTax({
        name: '',
        applicationType: 'add',
        applicationOrder: 'before_stamp',
        appliesToPayment: false,
        valueType: 'percentage',
      });
      setIsCreating(false);
      onRefresh();
    } catch (error) {
      console.error('Error creating custom tax:', error);
      toast.error(t('error_creating_custom_tax'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddValue = async (taxId: string) => {
    const input = newValueInputs[taxId];
    if (!input?.value) {
      toast.error(t('value_required'));
      return;
    }

    const numValue = parseFloat(input.value);
    if (isNaN(numValue) || numValue < 0) {
      toast.error(t('invalid_value'));
      return;
    }

    setAddingValueTo(taxId);
    try {
      const { error } = await supabase
        .from('custom_tax_values')
        .insert({
          tax_type_id: taxId,
          value: numValue,
          label: input.label || null,
        });

      if (error) throw error;

      toast.success(t('value_added'));
      setNewValueInputs(prev => ({
        ...prev,
        [taxId]: { value: '', label: '' },
      }));
      onRefresh();
    } catch (error) {
      console.error('Error adding value:', error);
      toast.error(t('error_adding_value'));
    } finally {
      setAddingValueTo(null);
    }
  };

  const checkValueInUse = async (valueId: string) => {
    try {
      const { data, error } = await supabase.rpc('is_custom_tax_value_in_use', { value_id: valueId });
      if (error) throw error;

      if (data) {
        toast.error(t('value_in_use'));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking value usage:', error);
      toast.error(t('error_checking_usage'));
      return true;
    }
  };

  const handleDeleteValue = async () => {
    if (!deletingValueId) return;

    const inUse = await checkValueInUse(deletingValueId);
    if (inUse) {
      setDeletingValueId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_tax_values')
        .delete()
        .eq('id', deletingValueId);

      if (error) throw error;

      toast.success(t('value_deleted'));
      onRefresh();
    } catch (error) {
      console.error('Error deleting value:', error);
      toast.error(t('error_deleting_value'));
    } finally {
      setDeletingValueId(null);
    }
  };

  const handleDeleteTax = async () => {
    if (!deletingTaxId) return;

    // Check if any values are in use
    const tax = customTaxes.find(t => t.id === deletingTaxId);
    if (tax?.values?.length) {
      for (const value of tax.values) {
        const inUse = await checkValueInUse(value.id);
        if (inUse) {
          toast.error(t('tax_has_values_in_use'));
          setDeletingTaxId(null);
          return;
        }
      }
    }

    try {
      const { error } = await supabase
        .from('custom_tax_types')
        .delete()
        .eq('id', deletingTaxId);

      if (error) throw error;

      toast.success(t('tax_deleted'));
      onRefresh();
    } catch (error) {
      console.error('Error deleting tax:', error);
      toast.error(t('error_deleting_tax'));
    } finally {
      setDeletingTaxId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {t('custom_taxes')}
            </CardTitle>
            <CardDescription>
              {t('custom_taxes_description')}
            </CardDescription>
          </div>
          {!isCreating && (
            <Button onClick={() => setIsCreating(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {t('add_tax')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new tax form */}
        {isCreating && (
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('tax_name')}</Label>
                  <Input
                    value={newTax.name}
                    onChange={(e) => setNewTax(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('tax_name_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('value_type')}</Label>
                  <Select
                    value={newTax.valueType}
                    onValueChange={(v: 'fixed' | 'percentage') => setNewTax(prev => ({ ...prev, valueType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">{t('fixed_amount')}</SelectItem>
                      <SelectItem value="percentage">{t('percentage')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('application_type')}</Label>
                  <Select
                    value={newTax.applicationType}
                    onValueChange={(v: 'add' | 'deduct') => setNewTax(prev => ({ ...prev, applicationType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">{t('adds_to_total')}</SelectItem>
                      <SelectItem value="deduct">{t('deducts_from_total')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('application_order')}</Label>
                  <Select
                    value={newTax.applicationOrder}
                    onValueChange={(v: 'before_stamp' | 'after_stamp') => setNewTax(prev => ({ ...prev, applicationOrder: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before_stamp">{t('before_stamp_duty')}</SelectItem>
                      <SelectItem value="after_stamp">{t('after_stamp_duty')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="applies-to-payment"
                  checked={newTax.appliesToPayment}
                  onCheckedChange={(checked) => setNewTax(prev => ({ ...prev, appliesToPayment: checked }))}
                />
                <Label htmlFor="applies-to-payment">{t('applies_to_payment')}</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateTax} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {t('create')}
                </Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* List of existing custom taxes */}
        {customTaxes.length === 0 && !isCreating ? (
          <p className="text-muted-foreground text-center py-4">{t('no_custom_taxes')}</p>
        ) : (
          <div className="space-y-3">
            {customTaxes.map((tax) => (
              <Collapsible
                key={tax.id}
                open={expandedTaxes[tax.id]}
                onOpenChange={() => toggleExpanded(tax.id)}
              >
                <div className="border rounded-lg p-3">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className="font-medium">{tax.name}</span>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {tax.value_type === 'fixed' ? t('fixed') : '%'}
                          </Badge>
                          <Badge 
                            variant={tax.application_type === 'add' ? 'default' : 'destructive'} 
                            className="text-xs"
                          >
                            {tax.application_type === 'add' ? '+' : '-'}
                          </Badge>
                          {tax.applies_to_payment && (
                            <Badge variant="secondary" className="text-xs">
                              {t('payment')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {tax.values?.length || 0} {t('values')}
                        </Badge>
                        {expandedTaxes[tax.id] ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="pt-3 space-y-3">
                    {/* Values list */}
                    {tax.values && tax.values.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tax.values.map((value) => (
                          <Badge key={value.id} variant="outline" className="px-2 py-1">
                            {value.value}{tax.value_type === 'percentage' ? '%' : ' TND'}
                            {value.label && ` (${value.label})`}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 ml-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingValueId(value.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Add value form */}
                    <div className={`flex gap-2 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder={tax.value_type === 'fixed' ? t('amount') : '%'}
                        value={newValueInputs[tax.id]?.value || ''}
                        onChange={(e) => setNewValueInputs(prev => ({
                          ...prev,
                          [tax.id]: { ...prev[tax.id], value: e.target.value },
                        }))}
                        className="w-24"
                      />
                      <Input
                        type="text"
                        placeholder={t('label_optional')}
                        value={newValueInputs[tax.id]?.label || ''}
                        onChange={(e) => setNewValueInputs(prev => ({
                          ...prev,
                          [tax.id]: { ...prev[tax.id], label: e.target.value },
                        }))}
                        className="w-32"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddValue(tax.id)}
                        disabled={addingValueTo === tax.id}
                      >
                        {addingValueTo === tax.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <PlusCircle className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingTaxId(tax.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Delete tax confirmation */}
        <AlertDialog open={!!deletingTaxId} onOpenChange={() => setDeletingTaxId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('confirm_delete_custom_tax')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTax} className="bg-destructive text-destructive-foreground">
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete value confirmation */}
        <AlertDialog open={!!deletingValueId} onOpenChange={() => setDeletingValueId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('confirm_delete_tax_value')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteValue} className="bg-destructive text-destructive-foreground">
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
