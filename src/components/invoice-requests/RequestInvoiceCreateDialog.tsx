import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  CalendarIcon, 
  FileText, 
  Loader2, 
  User,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InvoiceNumberInput } from '@/components/invoices/InvoiceNumberInput';
import { ProductSearch } from '@/components/invoices/ProductSearch';
import { InvoiceLineRow } from '@/components/invoices/InvoiceLineRow';
import { InvoiceTotals } from '@/components/invoices/InvoiceTotals';
import { StockBubbles } from '@/components/invoices/StockBubbles';
import { clampInvoiceLinesQuantityAtIndex, computeMaxQuantityByIndex } from '@/components/invoices/stockConstraints';
import {
  InvoiceLineFormData,
  StockBubble,
  INVOICE_PREFIXES,
  calculateLineTotal,
} from '@/components/invoices/types';
import { useTaxRates } from '@/hooks/useTaxRates';
import { InvoiceRequest } from './types';
import { RequestTTCComparisonBubble } from './RequestTTCComparisonBubble';
import { PaymentPromptDialog } from './PaymentPromptDialog';

interface RequestInvoiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: InvoiceRequest;
  onCreated: () => void;
}

export const RequestInvoiceCreateDialog: React.FC<RequestInvoiceCreateDialogProps> = ({
  open,
  onOpenChange,
  request,
  onCreated,
}) => {
  const { t, language, isRTL } = useLanguage();
  
  // Organization
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Client that will be created from the request
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [createdClientName, setCreatedClientName] = useState<string>('');
  const [isForeignClient, setIsForeignClient] = useState(false);
  
  // Form state
  const [invoiceDate] = useState<Date>(new Date(request.purchase_date));
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<{
    prefix: string;
    year: number;
    counter: number;
    number: string;
  }>({
    prefix: INVOICE_PREFIXES[language as keyof typeof INVOICE_PREFIXES] || 'FAC',
    year: new Date().getFullYear(),
    counter: 1,
    number: '',
  });
  const [isNumberValid, setIsNumberValid] = useState(false);
  
  // Lines
  const [lines, setLines] = useState<InvoiceLineFormData[]>([]);
  
  // Stamp duty
  const [stampDutyEnabled, setStampDutyEnabled] = useState(true);
  const [stampDutyAmount, setStampDutyAmount] = useState(1);
  
  // Custom taxes
  const [selectedCustomTaxes, setSelectedCustomTaxes] = useState<any[]>([]);
  
  // Fetch dynamic tax rates
  const { customTaxTypes, stampDutyAmount: defaultStampDuty } = useTaxRates(organizationId);
  
  // Loading
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  
  // Payment prompt
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  // Set default stamp duty from organization settings
  useEffect(() => {
    if (defaultStampDuty && defaultStampDuty !== stampDutyAmount) {
      setStampDutyAmount(defaultStampDuty);
    }
  }, [defaultStampDuty]);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  // Fetch organization and create client
  useEffect(() => {
    const initializeForm = async () => {
      if (!open) return;
      
      setIsLoading(true);
      setIsCreatingClient(true);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!org) return;
        setOrganizationId(org.id);

        // Check if client already exists
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id, client_type, first_name, last_name, company_name')
          .eq('organization_id', org.id)
          .eq('identifier_value', request.identifier_value)
          .maybeSingle();

        if (existingClient) {
          setCreatedClientId(existingClient.id);
          setIsForeignClient(existingClient.client_type === 'foreign');
          setCreatedClientName(
            existingClient.company_name || 
            `${existingClient.first_name || ''} ${existingClient.last_name || ''}`.trim()
          );
        } else {
          // Create new client from request
          const clientType = request.client_type === 'business_local' ? 'business_local' :
                             request.client_type === 'foreign' ? 'foreign' : 'individual_local';
          
          const { data: newClient, error } = await supabase
            .from('clients')
            .insert({
              organization_id: org.id,
              client_type: clientType,
              first_name: request.first_name || null,
              last_name: request.last_name || null,
              company_name: request.company_name || null,
              identifier_type: request.identifier_type,
              identifier_value: request.identifier_value,
              email: request.email || null,
              phone: request.phone || null,
              phone_prefix: request.phone_prefix || null,
              whatsapp: request.whatsapp || null,
              whatsapp_prefix: request.whatsapp_prefix || null,
              address: request.address || null,
              governorate: request.governorate || null,
              postal_code: request.postal_code || null,
              country: request.country || 'Tunisie',
            })
            .select()
            .single();

          if (error) throw error;

          setCreatedClientId(newClient.id);
          setIsForeignClient(newClient.client_type === 'foreign');
          setCreatedClientName(
            newClient.company_name || 
            `${newClient.first_name || ''} ${newClient.last_name || ''}`.trim()
          );
        }
      } catch (error) {
        console.error('Error initializing form:', error);
        toast.error(t('error_creating_client'));
      } finally {
        setIsLoading(false);
        setIsCreatingClient(false);
      }
    };

    initializeForm();
  }, [open, request]);

  // Stock bubbles calculation
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
        productMap.set(line.product_id, {
          product_id: line.product_id,
          product_name: line.product_name,
          original_stock: line.current_stock,
          quantity_used: line.quantity,
          remaining_stock: line.unlimited_stock ? null : 
            line.current_stock !== null ? line.current_stock - line.quantity : null,
          unlimited_stock: line.unlimited_stock,
        });
      }
    });

    return Array.from(productMap.values());
  }, [lines]);

  const maxQuantities = useMemo(() => computeMaxQuantityByIndex(lines), [lines]);

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
      reserved_stock: product.reserved_stock || 0,
    };
    setLines([...lines, newLine]);
  };

  // Handle line update (with stock clamp)
  const handleUpdateLine = (index: number, updates: Partial<InvoiceLineFormData>) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      if (typeof updates.quantity === 'number') {
        return clampInvoiceLinesQuantityAtIndex(next, index);
      }
      return next;
    });
  };

  // Handle line removal
  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

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

  // Calculate net payable
  const stampDuty = isForeignClient ? 0 : stampDutyEnabled ? stampDutyAmount : 0;
  const netPayable = totals.totalTtc + stampDuty;
  
  // Check if TTC matches request
  const ttcMatches = Math.abs(netPayable - request.total_ttc) < 0.001;

  // Handle save
  const handleSave = async () => {
    if (!organizationId || !createdClientId || !dueDate || lines.length === 0) {
      toast.error(t('fill_required_fields'));
      return;
    }

    if (!isNumberValid) {
      toast.error(t('invalid_invoice_number'));
      return;
    }

    if (!ttcMatches) {
      toast.error(t('invoice_below_request'));
      return;
    }

    setIsSaving(true);
    try {
      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          organization_id: organizationId,
          client_id: createdClientId,
          invoice_number: invoiceNumber.number,
          invoice_prefix: invoiceNumber.prefix,
          invoice_year: invoiceNumber.year,
          invoice_counter: invoiceNumber.counter,
          invoice_date: format(invoiceDate, 'yyyy-MM-dd'),
          due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
          client_type: isForeignClient ? 'foreign' : 'individual_local',
          currency: 'TND',
          exchange_rate: 1,
          subtotal_ht: totals.subtotalHt,
          total_vat: totals.totalVat,
          total_discount: totals.totalDiscount,
          total_ttc: totals.totalTtc,
          stamp_duty_enabled: isForeignClient ? false : stampDutyEnabled,
          stamp_duty_amount: stampDuty,
          net_payable: netPayable,
          status: 'created',
          payment_status: 'unpaid',
          invoice_request_id: request.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice lines
      const invoiceLines = lines.map((line, index) => {
        const { lineHt, lineVat, lineTtc } = calculateLineTotal(
          line.quantity,
          line.unit_price_ht,
          line.vat_rate,
          line.discount_percent,
          isForeignClient
        );

        return {
          invoice_id: invoice.id,
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

      // Update stock for each product
      for (const bubble of stockBubbles) {
        if (!bubble.unlimited_stock) {
          const { data: product } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', bubble.product_id)
            .single();

          const previousStock = product?.current_stock || 0;
          const newStock = previousStock - bubble.quantity_used;

          await supabase
            .from('stock_movements')
            .insert({
              product_id: bubble.product_id,
              movement_type: 'remove',
              quantity: bubble.quantity_used,
              previous_stock: previousStock,
              new_stock: newStock,
              reason_category: 'commercial',
              reason_detail: `Facture ${invoiceNumber.number} (Demande ${request.request_number})`,
            });

          await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', bubble.product_id);
        }
      }

      // Update request status
      await supabase
        .from('invoice_requests')
        .update({ 
          status: 'processed',
          generated_invoice_id: invoice.id,
          linked_client_id: createdClientId,
        })
        .eq('id', request.id);

      toast.success(t('invoice_created_from_request'));
      
      // Check if payment should be processed
      if (request.payment_status !== 'unpaid' && request.paid_amount > 0) {
        setCreatedInvoiceId(invoice.id);
        setPaymentPromptOpen(true);
      } else {
        onCreated();
        onOpenChange(false);
        resetForm();
      }
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error(error.message || t('error_creating_invoice'));
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setDueDate(null);
    setLines([]);
    setStampDutyEnabled(true);
    setStampDutyAmount(defaultStampDuty || 1);
    setSelectedCustomTaxes([]);
    setCreatedClientId(null);
    setCreatedClientName('');
  };

  const handlePaymentPromptClose = (processPayment: boolean) => {
    setPaymentPromptOpen(false);
    onCreated();
    onOpenChange(false);
    resetForm();
    
    if (processPayment && createdInvoiceId) {
      // Navigate to invoices page with payment dialog open
      window.location.href = `/dashboard/invoices?openPayment=${createdInvoiceId}`;
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[95vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p>{isCreatingClient ? t('creating_client') : t('loading')}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="max-w-6xl h-[95vh] max-h-[95vh] p-0 overflow-hidden grid grid-rows-[auto,1fr,auto]" 
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5 text-primary" />
              {t('create_invoice_from_request')}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t('from_request')}: #{request.request_number}
            </p>
          </DialogHeader>

          <ScrollArea className="min-h-0">
            <div className="p-6 space-y-6">
              {/* Locked fields from request */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  {t('client_locked_from_request')}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('client')}</Label>
                    <div className="flex items-center gap-2 bg-background rounded-md border p-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{createdClientName}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{t('invoice_date')}</Label>
                    <div className="flex items-center gap-2 bg-background rounded-md border p-3">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(invoiceDate, 'PPP', { locale: getDateLocale() })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Number */}
              <div className="grid grid-cols-2 gap-6">
                <InvoiceNumberInput
                  invoiceDate={invoiceDate}
                  organizationId={organizationId}
                  value={invoiceNumber}
                  onChange={setInvoiceNumber}
                  onValidityChange={setIsNumberValid}
                />

                <div className="space-y-2">
                  <Label>{t('due_date')} *</Label>
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

              <Separator />

              {/* Product Search */}
              <div className="space-y-4">
                <Label>{t('add_products')}</Label>
                <ProductSearch
                  onSelectProduct={handleSelectProduct}
                  organizationId={organizationId}
                />
              </div>

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
                  currency="TND"
                  stampDutyEnabled={stampDutyEnabled}
                  stampDutyAmount={stampDutyAmount}
                  onStampDutyEnabledChange={setStampDutyEnabled}
                  onStampDutyAmountChange={setStampDutyAmount}
                  customTaxTypes={customTaxTypes}
                  selectedCustomTaxes={selectedCustomTaxes}
                  onCustomTaxesChange={setSelectedCustomTaxes}
                />
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t bg-background/95 backdrop-blur flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !dueDate || lines.length === 0 || !isNumberValid || !ttcMatches}
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
                  {t('create')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TTC Comparison Bubble */}
      {open && lines.length > 0 && (
        <RequestTTCComparisonBubble
          requestTTC={request.total_ttc}
          currentTTC={netPayable}
        />
      )}

      {/* Payment Prompt Dialog */}
      <PaymentPromptDialog
        open={paymentPromptOpen}
        onClose={handlePaymentPromptClose}
        paidAmount={request.paid_amount}
        paymentStatus={request.payment_status}
      />
    </>
  );
};
