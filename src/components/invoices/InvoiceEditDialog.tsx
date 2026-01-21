import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CalendarIcon, 
  FileText, 
  Loader2, 
  Plus,
  User,
  Pencil,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductSearch } from './ProductSearch';
import { InvoiceLineRow } from './InvoiceLineRow';
import { InvoiceTotals } from './InvoiceTotals';
import { StockBubbles } from './StockBubbles';
import { clampInvoiceLinesQuantityAtIndex, computeMaxQuantityByIndex } from './stockConstraints';
import { ClientCreateDialog } from '@/components/clients/ClientCreateDialog';
import {
  InvoiceLineFormData,
  StockBubble,
  CURRENCIES,
  calculateLineTotal,
} from './types';

interface Client {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

interface InvoiceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  invoiceId: string | null;
  useMode?: boolean; // When true, saves with status "created" instead of keeping current status
}

interface OriginalLineQuantity {
  product_id: string;
  quantity: number;
}

export const InvoiceEditDialog: React.FC<InvoiceEditDialogProps> = ({
  open,
  onOpenChange,
  onUpdated,
  invoiceId,
  useMode = false,
}) => {
  const { t, language, isRTL } = useLanguage();
  
  // Organization
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Form state
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  // Client
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientCreateDialogOpen, setClientCreateDialogOpen] = useState(false);
  
  // Lines
  const [lines, setLines] = useState<InvoiceLineFormData[]>([]);
  const [originalLines, setOriginalLines] = useState<OriginalLineQuantity[]>([]);
  
  // Currency (for foreign clients)
  const [currency, setCurrency] = useState('TND');
  const [exchangeRate, setExchangeRate] = useState(1);
  
  // Stamp duty
  const [stampDutyEnabled, setStampDutyEnabled] = useState(true);
  const [stampDutyAmount, setStampDutyAmount] = useState(1);
  
  // Loading
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedClient = useMemo(() => 
    clients.find(c => c.id === selectedClientId),
    [clients, selectedClientId]
  );
  
  const isForeignClient = selectedClient?.client_type === 'foreign';

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  // Fetch organization
  useEffect(() => {
    const fetchOrg = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) setOrganizationId(data.id);
    };
    if (open) fetchOrg();
  }, [open]);

  // Fetch clients
  const fetchClients = useCallback(async () => {
    if (!organizationId) return;

    const { data, error } = await supabase
      .from('clients')
      .select('id, client_type, first_name, last_name, company_name')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setClients(data as Client[]);
    }
  }, [organizationId]);

  useEffect(() => {
    if (open && organizationId) {
      fetchClients();
    }
  }, [open, organizationId, fetchClients]);

  // Fetch invoice data
  useEffect(() => {
    const fetchInvoice = async () => {
      if (!invoiceId || !open) return;

      setIsLoading(true);
      try {
        // Fetch invoice
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', invoiceId)
          .single();

        if (invoiceError) throw invoiceError;

        // Fetch invoice lines with product details
        const { data: linesData, error: linesError } = await supabase
          .from('invoice_lines')
          .select(`
            *,
            product:products(
              id,
              name,
              reference,
              price_ht,
              vat_rate,
              max_discount,
              current_stock,
              unlimited_stock,
              allow_out_of_stock_sale
            )
          `)
          .eq('invoice_id', invoiceId)
          .order('line_order', { ascending: true });

        if (linesError) throw linesError;

        // Set form state
        setInvoiceDate(new Date(invoiceData.invoice_date));
        setDueDate(invoiceData.due_date ? new Date(invoiceData.due_date) : null);
        setInvoiceNumber(invoiceData.invoice_number);
        setSelectedClientId(invoiceData.client_id);
        setCurrency(invoiceData.currency);
        setExchangeRate(invoiceData.exchange_rate || 1);
        setStampDutyEnabled(invoiceData.stamp_duty_enabled);
        setStampDutyAmount(invoiceData.stamp_duty_amount);

        // Convert lines to form data
        const formLines: InvoiceLineFormData[] = (linesData || []).map((line: any) => ({
          product_id: line.product_id,
          product_name: line.product?.name || '',
          product_reference: line.product?.reference || null,
          description: line.description || '',
          quantity: line.quantity,
          unit_price_ht: line.unit_price_ht,
          vat_rate: line.vat_rate,
          discount_percent: line.discount_percent,
          max_discount: line.product?.max_discount || 100,
          current_stock: line.product?.current_stock,
          unlimited_stock: line.product?.unlimited_stock || false,
          allow_out_of_stock_sale: line.product?.allow_out_of_stock_sale || false,
        }));

        setLines(formLines);

        // Store original quantities for stock calculation
        const originals: OriginalLineQuantity[] = (linesData || []).map((line: any) => ({
          product_id: line.product_id,
          quantity: line.quantity,
        }));
        setOriginalLines(originals);

      } catch (error) {
        console.error('Error fetching invoice:', error);
        toast.error(t('error_loading_invoice'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId, open, t]);

  // Stock bubbles calculation (shows the difference from original)
  // For useMode (draft invoice), stock was already restored so we use current_stock directly
  // For normal edit (created invoice), we add back originalQty since stock is still deducted
  const stockBubbles = useMemo<StockBubble[]>(() => {
    const productMap = new Map<string, StockBubble>();

    lines.forEach((line) => {
      const existing = productMap.get(line.product_id);
      if (existing) {
        existing.quantity_used += line.quantity;
        if (!existing.unlimited_stock && existing.original_stock !== null) {
          existing.remaining_stock = existing.original_stock - existing.quantity_used;
        }
      } else {
        // Find original quantity for this product
        const originalQty = originalLines
          .filter(ol => ol.product_id === line.product_id)
          .reduce((sum, ol) => sum + ol.quantity, 0);
        
        // For useMode (draft): stock was restored, so current_stock is the real available stock
        // For normal edit (created): stock is still deducted, so we add back originalQty
        const adjustedStock = line.current_stock !== null 
          ? (useMode ? line.current_stock : line.current_stock + originalQty)
          : null;

        productMap.set(line.product_id, {
          product_id: line.product_id,
          product_name: line.product_name,
          original_stock: adjustedStock,
          quantity_used: line.quantity,
          remaining_stock: line.unlimited_stock ? null : 
            adjustedStock !== null ? adjustedStock - line.quantity : null,
          unlimited_stock: line.unlimited_stock,
        });
      }
    });

    return Array.from(productMap.values());
  }, [lines, originalLines, useMode]);

  const originalTotalsByProduct = useMemo(() => {
    const map = new Map<string, number>();
    originalLines.forEach((ol) => {
      map.set(ol.product_id, (map.get(ol.product_id) || 0) + ol.quantity);
    });
    return map;
  }, [originalLines]);

  // For useMode, originalTotalsByProduct should be empty (no stock adjustment needed)
  // because stock was already restored when invoice was cancelled
  const effectiveOriginalTotals = useMemo(() => {
    return useMode ? new Map<string, number>() : originalTotalsByProduct;
  }, [useMode, originalTotalsByProduct]);

  const maxQuantities = useMemo(
    () => computeMaxQuantityByIndex(lines, effectiveOriginalTotals),
    [lines, effectiveOriginalTotals]
  );

  // Handle product selection
  const handleSelectProduct = (product: any) => {
    const newLine: InvoiceLineFormData = {
      product_id: product.id,
      product_name: product.name,
      product_reference: product.reference,
      description: '',
      quantity: 1,
      unit_price_ht: product.price_ht,
      vat_rate: isForeignClient ? 0 : product.vat_rate,
      discount_percent: 0,
      max_discount: product.max_discount || 100,
      current_stock: product.current_stock,
      unlimited_stock: product.unlimited_stock,
      allow_out_of_stock_sale: product.allow_out_of_stock_sale || false,
    };
    setLines([...lines, newLine]);
  };

  // Handle line update (with stock clamp)
  const handleUpdateLine = (index: number, updates: Partial<InvoiceLineFormData>) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      if (typeof updates.quantity === 'number') {
        return clampInvoiceLinesQuantityAtIndex(next, index, effectiveOriginalTotals);
      }
      return next;
    });
  };

  // Handle line removal
  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  // Calculate totals
  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const { lineHt, lineVat, lineTtc } = calculateLineTotal(
          line.quantity,
          line.unit_price_ht,
          line.vat_rate,
          line.discount_percent,
          isForeignClient
        );
        acc.subtotalHt += lineHt;
        acc.totalVat += lineVat;
        acc.totalTtc += lineTtc;
        
        const grossHt = line.quantity * line.unit_price_ht;
        acc.totalDiscount += grossHt - lineHt;
        
        return acc;
      },
      { subtotalHt: 0, totalVat: 0, totalTtc: 0, totalDiscount: 0 }
    );
  }, [lines, isForeignClient]);

  // Handle save
  const handleSave = async () => {
    if (!invoiceId || !organizationId || !selectedClientId || !invoiceDate || lines.length === 0) {
      toast.error(t('fill_required_fields'));
      return;
    }

    setIsSaving(true);
    try {
      const stampDuty = isForeignClient ? 0 : stampDutyEnabled ? stampDutyAmount : 0;
      const netPayable = totals.totalTtc + stampDuty;

      // Update invoice
      const updateData: Record<string, unknown> = {
        client_id: selectedClientId,
        invoice_date: format(invoiceDate, 'yyyy-MM-dd'),
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        client_type: selectedClient?.client_type || 'individual_local',
        currency: isForeignClient ? currency : 'TND',
        exchange_rate: isForeignClient ? exchangeRate : 1,
        subtotal_ht: totals.subtotalHt,
        total_vat: totals.totalVat,
        total_discount: totals.totalDiscount,
        total_ttc: totals.totalTtc,
        stamp_duty_enabled: isForeignClient ? false : stampDutyEnabled,
        stamp_duty_amount: stampDuty,
        net_payable: netPayable,
      };

      // If useMode is true, change status to "created"
      if (useMode) {
        updateData.status = 'created';
      }

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      // Delete existing invoice lines
      const { error: deleteError } = await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', invoiceId);

      if (deleteError) throw deleteError;

      // Create new invoice lines
      const invoiceLines = lines.map((line, index) => {
        const { lineHt, lineVat, lineTtc } = calculateLineTotal(
          line.quantity,
          line.unit_price_ht,
          line.vat_rate,
          line.discount_percent,
          isForeignClient
        );

        return {
          invoice_id: invoiceId,
          product_id: line.product_id,
          description: line.description || null,
          quantity: line.quantity,
          unit_price_ht: line.unit_price_ht,
          vat_rate: line.vat_rate,
          discount_percent: line.discount_percent,
          line_total_ht: lineHt,
          line_vat: lineVat,
          line_total_ttc: lineTtc,
          line_order: index,
        };
      });

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(invoiceLines);

      if (linesError) throw linesError;

      // Calculate stock differences and update
      const stockDifferences = new Map<string, number>();
      
      // Calculate current quantities by product
      lines.forEach(line => {
        const current = stockDifferences.get(line.product_id) || 0;
        stockDifferences.set(line.product_id, current + line.quantity);
      });
      
      // Calculate original quantities by product
      const originalQuantities = new Map<string, number>();
      originalLines.forEach(ol => {
        const current = originalQuantities.get(ol.product_id) || 0;
        originalQuantities.set(ol.product_id, current + ol.quantity);
      });

      // Calculate differences and update stock
      const allProductIds = new Set([...stockDifferences.keys(), ...originalQuantities.keys()]);
      
      for (const productId of allProductIds) {
        const newQty = stockDifferences.get(productId) || 0;
        const oldQty = originalQuantities.get(productId) || 0;
        const diff = newQty - oldQty;

        if (diff !== 0) {
          // Get product info
          const { data: product } = await supabase
            .from('products')
            .select('current_stock, unlimited_stock')
            .eq('id', productId)
            .single();

          if (product && !product.unlimited_stock) {
            const previousStock = product.current_stock || 0;
            const newStock = previousStock - diff;

            // Create stock movement
            await supabase
              .from('stock_movements')
              .insert({
                product_id: productId,
                movement_type: diff > 0 ? 'remove' : 'add',
                quantity: Math.abs(diff),
                previous_stock: previousStock,
                new_stock: newStock,
                reason_category: 'commercial',
                reason_detail: `Modification Facture ${invoiceNumber}`,
              });

            // Update product stock
            await supabase
              .from('products')
              .update({ current_stock: newStock })
              .eq('id', productId);
          }
        }
      }

      toast.success(useMode ? t('invoice_activated') : t('invoice_updated'));
      onUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast.error(error.message || t('error_updating_invoice'));
    } finally {
      setIsSaving(false);
    }
  };

  const getClientName = (client: Client): string => {
    if (client.company_name) return client.company_name;
    return `${client.first_name || ''} ${client.last_name || ''}`.trim();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="max-w-6xl h-[95vh] max-h-[95vh] p-0 overflow-hidden grid grid-rows-[auto,1fr,auto]" 
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              {useMode ? (
                <RefreshCw className="h-5 w-5 text-primary" />
              ) : (
                <Pencil className="h-5 w-5 text-primary" />
              )}
              {useMode ? t('use_invoice') : t('edit_invoice')}
              {invoiceNumber && (
                <span className="font-mono text-muted-foreground">
                  {invoiceNumber}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="min-h-0">
            {isLoading ? (
              <div className="p-6 space-y-6">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Date Row */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Invoice Date */}
                  <div className="space-y-2">
                    <Label>{t('invoice_date')} *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !invoiceDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {invoiceDate ? format(invoiceDate, 'PPP', { locale: getDateLocale() }) : t('select_date')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={invoiceDate || undefined}
                          onSelect={(date) => setInvoiceDate(date || null)}
                          initialFocus
                          locale={getDateLocale()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Invoice Number (read-only) */}
                  <div className="space-y-2">
                    <Label>{t('invoice_number')}</Label>
                    <Input 
                      value={invoiceNumber} 
                      disabled 
                      className="font-mono bg-muted"
                    />
                  </div>
                </div>

                <Separator />

                {/* Client Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('client')} *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => setClientCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      {t('add_client')}
                    </Button>
                  </div>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_client')} />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {getClientName(client)}
                            <span className="text-xs text-muted-foreground">
                              ({t(client.client_type)})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Currency (for foreign clients) */}
                {isForeignClient && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('currency')}</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((curr) => (
                            <SelectItem key={curr.code} value={curr.code}>
                              {curr.code} - {curr.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('exchange_rate')} (TND → {currency})</Label>
                      <Input
                        type="number"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                        step="0.0001"
                      />
                    </div>
                  </div>
                )}

                <Separator />

                {/* Product Search */}
                {selectedClientId && (
                  <div className="space-y-4">
                    <Label>{t('add_products')}</Label>
                    <ProductSearch
                      onSelectProduct={handleSelectProduct}
                      organizationId={organizationId}
                    />
                  </div>
                )}

                {/* Stock Bubbles */}
                {stockBubbles.length > 0 && (
                  <StockBubbles bubbles={stockBubbles} />
                )}

                {/* Invoice Lines */}
                {lines.length > 0 && (
                  <div className="space-y-4">
                    <Label>{t('invoice_lines')}</Label>
                    <div className="space-y-3">
                      {lines.map((line, index) => (
                        <InvoiceLineRow
                          key={`${line.product_id}-${index}`}
                          line={line}
                          index={index}
                          isForeign={isForeignClient}
                          maxQuantity={maxQuantities[index] ?? null}
                          onUpdate={handleUpdateLine}
                          onRemove={handleRemoveLine}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                {lines.length > 0 && (
                  <InvoiceTotals
                    lines={lines}
                    isForeign={isForeignClient}
                    currency={currency}
                    stampDutyEnabled={stampDutyEnabled}
                    stampDutyAmount={stampDutyAmount}
                    onStampDutyEnabledChange={setStampDutyEnabled}
                    onStampDutyAmountChange={setStampDutyAmount}
                  />
                )}

                {/* Due Date */}
                <div className="space-y-2">
                  <Label>{t('due_date')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !dueDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, 'PPP', { locale: getDateLocale() }) : t('select_date')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dueDate || undefined}
                        onSelect={(date) => setDueDate(date || null)}
                        initialFocus
                        locale={getDateLocale()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t bg-background/95 backdrop-blur flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading || !invoiceDate || !selectedClientId || lines.length === 0}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  {t('save')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Create Dialog */}
      <ClientCreateDialog
        open={clientCreateDialogOpen}
        onOpenChange={setClientCreateDialogOpen}
        onCreated={() => {
          fetchClients();
        }}
        duplicateFrom={null}
      />
    </>
  );
};
