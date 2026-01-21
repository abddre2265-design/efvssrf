import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
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
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InvoiceNumberInput } from './InvoiceNumberInput';
import { ProductSearch } from './ProductSearch';
import { InvoiceLineRow } from './InvoiceLineRow';
import { InvoiceTotals } from './InvoiceTotals';
import { StockBubbles } from './StockBubbles';
import { ClientReservationsDialog } from './ClientReservationsDialog';
import { clampInvoiceLinesQuantityAtIndex, computeMaxQuantityByIndex } from './stockConstraints';
import { ClientCreateDialog } from '@/components/clients/ClientCreateDialog';
import {
  InvoiceLineFormData,
  StockBubble,
  CURRENCIES,
  INVOICE_PREFIXES,
  calculateLineTotal,
  generateInvoiceNumber,
} from './types';
import { Language } from '@/contexts/LanguageContext';

interface Client {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

interface InvoiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export const InvoiceCreateDialog: React.FC<InvoiceCreateDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const { t, language, isRTL } = useLanguage();
  
  // Organization
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Form state
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(null);
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
  
  // Client
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientCreateDialogOpen, setClientCreateDialogOpen] = useState(false);
  
  // Lines
  const [lines, setLines] = useState<InvoiceLineFormData[]>([]);
  
  // Currency (for foreign clients)
  const [currency, setCurrency] = useState('TND');
  const [exchangeRate, setExchangeRate] = useState(1);
  
  // Stamp duty
  const [stampDutyEnabled, setStampDutyEnabled] = useState(true);
  const [stampDutyAmount, setStampDutyAmount] = useState(1);
  
  // Loading
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Reservations dialog
  const [reservationsDialogOpen, setReservationsDialogOpen] = useState(false);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);

  const selectedClient = useMemo(() => 
    clients.find(c => c.id === selectedClientId),
    [clients, selectedClientId]
  );
  
  const isForeignClient = selectedClient?.client_type === 'foreign';
  
  // Check if any lines come from reservations - if so, lock client selection
  const hasReservationLines = useMemo(() => 
    lines.some(line => line.fromReservation),
    [lines]
  );

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

  // Check if client has reservations when selecting
  const handleClientChange = async (clientId: string) => {
    setSelectedClientId(clientId);
    
    if (!clientId) return;
    
    // Check if client has active reservations
    try {
      const { data, error } = await supabase
        .from('product_reservations')
        .select('id')
        .eq('client_id', clientId)
        .in('status', ['active', 'expired'])
        .limit(1);
      
      if (!error && data && data.length > 0) {
        setPendingClientId(clientId);
        setReservationsDialogOpen(true);
      }
    } catch (error) {
      console.error('Error checking reservations:', error);
    }
  };

  // Handle adding reservations to invoice
  const handleAddReservations = (selectedReservations: Array<{
    reservation: {
      id: string;
      product_id: string;
      quantity: number;
      product: {
        id: string;
        name: string;
        reference: string | null;
        price_ht: number;
        vat_rate: number;
        max_discount: number | null;
        current_stock: number | null;
        unlimited_stock: boolean;
        allow_out_of_stock_sale: boolean | null;
        reserved_stock: number;
      };
    };
    quantityToUse: number;
  }>) => {
    const reservationLines: InvoiceLineFormData[] = selectedReservations.map(({ reservation, quantityToUse }) => ({
      product_id: reservation.product.id,
      product_name: reservation.product.name,
      product_reference: reservation.product.reference,
      description: '',
      quantity: quantityToUse,
      unit_price_ht: reservation.product.price_ht,
      vat_rate: isForeignClient ? 0 : reservation.product.vat_rate,
      discount_percent: 0,
      max_discount: reservation.product.max_discount || 100,
      current_stock: reservation.product.current_stock,
      unlimited_stock: reservation.product.unlimited_stock,
      allow_out_of_stock_sale: reservation.product.allow_out_of_stock_sale || false,
      fromReservation: true,
      reservationId: reservation.id,
      reservationQuantity: quantityToUse,
      reserved_stock: reservation.product.reserved_stock,
    }));
    
    setLines((prev) => [...reservationLines, ...prev]);
  };

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

  // Handle save
  const handleSave = async () => {
    if (!organizationId || !selectedClientId || !invoiceDate || !dueDate || lines.length === 0) {
      toast.error(t('fill_required_fields'));
      return;
    }

    if (!isNumberValid) {
      toast.error(t('invalid_invoice_number'));
      return;
    }

    setIsSaving(true);
    try {
      const stampDuty = isForeignClient ? 0 : stampDutyEnabled ? stampDutyAmount : 0;
      const netPayable = totals.totalTtc + stampDuty;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          organization_id: organizationId,
          client_id: selectedClientId,
          invoice_number: invoiceNumber.number,
          invoice_prefix: invoiceNumber.prefix,
          invoice_year: invoiceNumber.year,
          invoice_counter: invoiceNumber.counter,
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
          status: 'created',
          payment_status: 'unpaid',
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

      // Process reservation lines - update reservation status and reserved_stock
      const reservationLines = lines.filter(line => line.fromReservation && line.reservationId);
      for (const line of reservationLines) {
        // Get current reservation
        const { data: reservation } = await supabase
          .from('product_reservations')
          .select('quantity')
          .eq('id', line.reservationId!)
          .maybeSingle();
        
        if (reservation) {
          const remainingQuantity = reservation.quantity - line.quantity;
          
          if (remainingQuantity <= 0) {
            // Fully consumed - mark as used
            await supabase
              .from('product_reservations')
              .update({ status: 'used', quantity: 0 })
              .eq('id', line.reservationId!);
          } else {
            // Partially consumed - update remaining quantity
            await supabase
              .from('product_reservations')
              .update({ quantity: remainingQuantity })
              .eq('id', line.reservationId!);
          }
          
          // Update product reserved_stock
          const { data: product } = await supabase
            .from('products')
            .select('reserved_stock')
            .eq('id', line.product_id)
            .maybeSingle();
          
          if (product) {
            const newReservedStock = Math.max(0, (product.reserved_stock || 0) - line.quantity);
            await supabase
              .from('products')
              .update({ reserved_stock: newReservedStock })
              .eq('id', line.product_id);
          }
        }
      }

      // Update stock for each product (non-reservation lines only affect available stock)
      for (const bubble of stockBubbles) {
        if (!bubble.unlimited_stock) {
          // Create stock movement
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
              reason_detail: `Facture ${invoiceNumber.number}`,
            });

          // Update product stock
          await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', bubble.product_id);
        }
      }

      toast.success(t('invoice_created_success'));
      onCreated();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error(error.message || t('error_creating_invoice'));
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setInvoiceDate(null);
    setDueDate(null);
    setSelectedClientId('');
    setLines([]);
    setCurrency('TND');
    setExchangeRate(1);
    setStampDutyEnabled(true);
    setStampDutyAmount(1);
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
              <FileText className="h-5 w-5 text-primary" />
              {t('create_invoice')}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="min-h-0">
            <div className="p-6 space-y-6">
              {/* Date and Invoice Number Row */}
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

                {/* Invoice Number */}
                <InvoiceNumberInput
                  invoiceDate={invoiceDate}
                  organizationId={organizationId}
                  value={invoiceNumber}
                  onChange={setInvoiceNumber}
                  onValidityChange={setIsNumberValid}
                />
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
                <Select 
                  value={selectedClientId} 
                  onValueChange={handleClientChange}
                  disabled={hasReservationLines}
                >
                  <SelectTrigger className={cn(hasReservationLines && "opacity-70 cursor-not-allowed")}>
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
                {hasReservationLines && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('client_locked_reservation')}
                  </p>
                )}
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
                        disableDelete={line.fromReservation === true}
                        disableQuantityEdit={line.fromReservation === true}
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
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t bg-background/95 backdrop-blur flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !invoiceDate || !dueDate || !selectedClientId || lines.length === 0 || !isNumberValid}
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

      {/* Client Create Dialog */}
      <ClientCreateDialog
        open={clientCreateDialogOpen}
        onOpenChange={setClientCreateDialogOpen}
        onCreated={() => {
          fetchClients();
        }}
        duplicateFrom={null}
      />

      {/* Client Reservations Dialog */}
      <ClientReservationsDialog
        clientId={pendingClientId}
        open={reservationsDialogOpen}
        onOpenChange={setReservationsDialogOpen}
        onAddReservations={handleAddReservations}
      />
    </>
  );
};
