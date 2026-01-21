import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Sparkles, Loader2, AlertCircle, CheckCircle2, User, Package, Calculator, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InvoiceNumberInput } from './InvoiceNumberInput';
import { StockBubbles } from './StockBubbles';
import { InvoiceLineFormData, StockBubble, INVOICE_PREFIXES, VAT_RATES, calculateLineTotal, formatCurrency } from './types';

interface Client {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

interface Product {
  id: string;
  name: string;
  reference: string | null;
  price_ht: number;
  price_ttc: number;
  vat_rate: number;
  max_discount: number | null;
  current_stock: number | null;
  unlimited_stock: boolean;
  allow_out_of_stock_sale: boolean | null;
}

interface VatTarget {
  vatRate: number;
  targetHt: string;
  targetTtc: string;
  editMode: 'ht' | 'ttc';
}

interface AIInvoiceGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
}

export const AIInvoiceGeneratorDialog: React.FC<AIInvoiceGeneratorDialogProps> = ({
  open,
  onOpenChange,
  onGenerated,
}) => {
  const { t, language, isRTL } = useLanguage();
  
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [step, setStep] = useState<'config' | 'preview' | 'saving'>('config');
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<{ prefix: string; year: number; counter: number; number: string }>({
    prefix: INVOICE_PREFIXES[language as keyof typeof INVOICE_PREFIXES] || 'FAC',
    year: new Date().getFullYear(),
    counter: 1,
    number: '',
  });
  const [isNumberValid, setIsNumberValid] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [maxLines, setMaxLines] = useState<string>('10');
  const [minPriceTtc, setMinPriceTtc] = useState<string>('0');
  const [maxPriceTtc, setMaxPriceTtc] = useState<string>('10000');
  const [allowedVatRates, setAllowedVatRates] = useState<number[]>([0, 7, 13, 19]);
  const [vatTargets, setVatTargets] = useState<VatTarget[]>([]);
  const [stampDutyEnabled, setStampDutyEnabled] = useState(true);
  const [stampDutyAmount, setStampDutyAmount] = useState(1);
  const [generatedLines, setGeneratedLines] = useState<InvoiceLineFormData[]>([]);
  const [generationSummary, setGenerationSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const isForeignClient = selectedClient?.client_type === 'foreign';

  const getDateLocale = () => {
    switch (language) { case 'ar': return arSA; case 'en': return enUS; default: return fr; }
  };

  useEffect(() => {
    const fetchOrg = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('organizations').select('id').eq('user_id', user.id).maybeSingle();
      if (data) setOrganizationId(data.id);
    };
    if (open) fetchOrg();
  }, [open]);

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    const [clientsRes, productsRes] = await Promise.all([
      supabase.from('clients').select('id, client_type, first_name, last_name, company_name').eq('organization_id', organizationId).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, reference, price_ht, price_ttc, vat_rate, max_discount, current_stock, unlimited_stock, allow_out_of_stock_sale').eq('organization_id', organizationId).eq('status', 'active').order('name'),
    ]);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (productsRes.data) setProducts(productsRes.data as Product[]);
    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => { if (open && organizationId) fetchData(); }, [open, organizationId, fetchData]);

  useEffect(() => {
    setVatTargets(prev => {
      const existing = new Map(prev.map(t => [t.vatRate, t]));
      return allowedVatRates.map(rate => existing.get(rate) || { vatRate: rate, targetHt: '', targetTtc: '', editMode: 'ht' as const });
    });
  }, [allowedVatRates]);

  const handleVatTargetChange = (index: number, field: 'targetHt' | 'targetTtc', value: string) => {
    setVatTargets(prev => {
      const next = [...prev];
      const target = { ...next[index] };
      if (field === 'targetHt') {
        target.targetHt = value;
        target.editMode = 'ht';
        target.targetTtc = value ? (isForeignClient ? value : (parseFloat(value) * (1 + target.vatRate / 100)).toFixed(3)) : '';
      } else {
        target.targetTtc = value;
        target.editMode = 'ttc';
        target.targetHt = value ? (isForeignClient ? value : (parseFloat(value) / (1 + target.vatRate / 100)).toFixed(3)) : '';
      }
      next[index] = target;
      return next;
    });
  };

  const handleVatRateToggle = (rate: number) => {
    setAllowedVatRates(prev => prev.includes(rate) ? prev.filter(r => r !== rate) : [...prev, rate].sort((a, b) => a - b));
  };

  const handleGenerate = async () => {
    if (!selectedClientId || !invoiceDate || allowedVatRates.length === 0) { toast.error(t('fill_required_fields')); return; }
    const activeTargets = vatTargets.filter(t => parseFloat(t.targetHt) > 0 || parseFloat(t.targetTtc) > 0);
    if (activeTargets.length === 0) { toast.error(t('enter_at_least_one_target')); return; }
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const response = await supabase.functions.invoke('generate-ai-invoice', {
        body: { clientId: selectedClientId, invoiceDate: format(invoiceDate, 'yyyy-MM-dd'), invoiceNumber, maxLines: parseInt(maxLines) || 10, minPriceTtc: parseFloat(minPriceTtc) || 0, maxPriceTtc: parseFloat(maxPriceTtc) || 999999, allowedVatRates, vatTargets: activeTargets.map(t => ({ vatRate: t.vatRate, targetHt: parseFloat(t.targetHt) || null, targetTtc: parseFloat(t.targetTtc) || null })), stampDutyEnabled: !isForeignClient && stampDutyEnabled, stampDutyAmount, products, isForeignClient },
      });
      if (response.error) throw response.error;
      const data = response.data;
      if (!data.success) { setGenerationError(data.message); toast.error(data.message); return; }
      const lines: InvoiceLineFormData[] = data.lines.map((line: any) => ({ product_id: line.product_id, product_name: line.product_name, product_reference: line.product_reference, description: '', quantity: line.quantity, unit_price_ht: line.unit_price_ht, vat_rate: isForeignClient ? 0 : line.vat_rate, discount_percent: line.discount_percent, max_discount: line.max_discount, current_stock: line.current_stock, unlimited_stock: line.unlimited_stock, allow_out_of_stock_sale: line.allow_out_of_stock_sale }));
      setGeneratedLines(lines);
      setGenerationSummary(data.summary);
      setStep('preview');
      toast.success(t('invoice_generated_successfully'));
    } catch (error: any) {
      const message = error.message || t('error_generating_invoice');
      setGenerationError(message);
      toast.error(message);
    } finally { setIsGenerating(false); }
  };

  const handleSave = async () => {
    if (!organizationId || !selectedClientId || !invoiceDate || generatedLines.length === 0 || !isNumberValid) return;
    setIsSaving(true);
    setStep('saving');
    try {
      const totals = generatedLines.reduce((acc, line) => { const { lineHt, lineVat, lineTtc } = calculateLineTotal(line.quantity, line.unit_price_ht, line.vat_rate, line.discount_percent, isForeignClient); acc.subtotalHt += lineHt; acc.totalVat += lineVat; acc.totalTtc += lineTtc; acc.totalDiscount += (line.quantity * line.unit_price_ht) - lineHt; return acc; }, { subtotalHt: 0, totalVat: 0, totalTtc: 0, totalDiscount: 0 });
      const stampDuty = isForeignClient ? 0 : stampDutyEnabled ? stampDutyAmount : 0;
      const netPayable = totals.totalTtc + stampDuty;
      const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({ organization_id: organizationId, client_id: selectedClientId, invoice_number: invoiceNumber.number, invoice_prefix: invoiceNumber.prefix, invoice_year: invoiceNumber.year, invoice_counter: invoiceNumber.counter, invoice_date: format(invoiceDate, 'yyyy-MM-dd'), due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null, client_type: selectedClient?.client_type || 'individual_local', currency: 'TND', exchange_rate: 1, subtotal_ht: totals.subtotalHt, total_vat: totals.totalVat, total_discount: totals.totalDiscount, total_ttc: totals.totalTtc, stamp_duty_enabled: isForeignClient ? false : stampDutyEnabled, stamp_duty_amount: stampDuty, net_payable: netPayable, status: 'created', payment_status: 'unpaid', notes: `Facture générée par IA` }).select().single();
      if (invoiceError) throw invoiceError;
      const invoiceLines = generatedLines.map((line, index) => { const { lineHt, lineVat, lineTtc } = calculateLineTotal(line.quantity, line.unit_price_ht, line.vat_rate, line.discount_percent, isForeignClient); return { invoice_id: invoice.id, product_id: line.product_id, description: line.description || null, quantity: line.quantity, unit_price_ht: line.unit_price_ht, vat_rate: line.vat_rate, discount_percent: line.discount_percent, line_total_ht: lineHt, line_vat: lineVat, line_total_ttc: lineTtc, line_order: index }; });
      const { error: linesError } = await supabase.from('invoice_lines').insert(invoiceLines);
      if (linesError) throw linesError;
      const stockMap = new Map<string, { quantity: number; product: InvoiceLineFormData }>();
      for (const line of generatedLines) { const existing = stockMap.get(line.product_id); if (existing) existing.quantity += line.quantity; else stockMap.set(line.product_id, { quantity: line.quantity, product: line }); }
      for (const [productId, { quantity, product }] of stockMap) { if (!product.unlimited_stock) { const { data: productData } = await supabase.from('products').select('current_stock').eq('id', productId).single(); const previousStock = productData?.current_stock || 0; const newStock = previousStock - quantity; await supabase.from('stock_movements').insert({ product_id: productId, movement_type: 'remove', quantity, previous_stock: previousStock, new_stock: newStock, reason_category: 'commercial', reason_detail: `Facture IA ${invoiceNumber.number}` }); await supabase.from('products').update({ current_stock: newStock }).eq('id', productId); } }
      toast.success(t('invoice_created_success'));
      onGenerated();
      onOpenChange(false);
      resetForm();
    } catch (error: any) { toast.error(error.message || t('error_creating_invoice')); setStep('preview'); } finally { setIsSaving(false); }
  };

  const resetForm = () => { setStep('config'); setInvoiceDate(null); setDueDate(null); setSelectedClientId(''); setMaxLines('10'); setMinPriceTtc('0'); setMaxPriceTtc('10000'); setAllowedVatRates([0, 7, 13, 19]); setVatTargets([]); setStampDutyEnabled(true); setGeneratedLines([]); setGenerationSummary(null); setGenerationError(null); };
  const getClientName = (client: Client): string => client.company_name || `${client.first_name || ''} ${client.last_name || ''}`.trim();

  const stockBubbles: StockBubble[] = React.useMemo(() => {
    const productMap = new Map<string, StockBubble>();
    generatedLines.forEach((line) => { const existing = productMap.get(line.product_id); if (existing) { existing.quantity_used += line.quantity; if (!existing.unlimited_stock && existing.original_stock !== null) existing.remaining_stock = existing.original_stock - existing.quantity_used; } else productMap.set(line.product_id, { product_id: line.product_id, product_name: line.product_name, original_stock: line.current_stock, quantity_used: line.quantity, remaining_stock: line.unlimited_stock ? null : line.current_stock !== null ? line.current_stock - line.quantity : null, unlimited_stock: line.unlimited_stock }); });
    return Array.from(productMap.values());
  }, [generatedLines]);

  const totals = React.useMemo(() => generatedLines.reduce((acc, line) => { const { lineHt, lineVat, lineTtc } = calculateLineTotal(line.quantity, line.unit_price_ht, line.vat_rate, line.discount_percent, isForeignClient); acc.subtotalHt += lineHt; acc.totalVat += lineVat; acc.totalTtc += lineTtc; acc.totalDiscount += (line.quantity * line.unit_price_ht) - lineHt; return acc; }, { subtotalHt: 0, totalVat: 0, totalTtc: 0, totalDiscount: 0 }), [generatedLines, isForeignClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[95vh] max-h-[95vh] p-0 overflow-hidden grid grid-rows-[auto,1fr,auto]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="p-6 pb-0 bg-gradient-to-r from-primary/10 to-accent/10">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            {t('ai_invoice_generator')}
          </DialogTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant={step === 'config' ? 'default' : 'secondary'}>1. {t('configuration')}</Badge>
            <Badge variant={step === 'preview' ? 'default' : 'secondary'}>2. {t('preview')}</Badge>
            <Badge variant={step === 'saving' ? 'default' : 'secondary'}>3. {t('save')}</Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          <AnimatePresence mode="wait">
            {step === 'config' && (
              <motion.div key="config" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="p-6 space-y-6">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />{t('client_and_date')}</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('client')} *</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger><SelectValue placeholder={t('select_client')} /></SelectTrigger>
                        <SelectContent>{clients.map((client) => (<SelectItem key={client.id} value={client.id}><div className="flex items-center gap-2"><User className="h-4 w-4" />{getClientName(client)}<span className="text-xs text-muted-foreground">({t(client.client_type)})</span></div></SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('invoice_date')} *</Label>
                      <Popover><PopoverTrigger asChild><Button variant="outline" className={cn('w-full justify-start text-left font-normal', !invoiceDate && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{invoiceDate ? format(invoiceDate, 'PPP', { locale: getDateLocale() }) : t('select_date')}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={invoiceDate || undefined} onSelect={(date) => setInvoiceDate(date || null)} initialFocus locale={getDateLocale()} /></PopoverContent></Popover>
                    </div>
                    <InvoiceNumberInput invoiceDate={invoiceDate} organizationId={organizationId} value={invoiceNumber} onChange={setInvoiceNumber} onValidityChange={setIsNumberValid} />
                    <div className="space-y-2">
                      <Label>{t('due_date')}</Label>
                      <Popover><PopoverTrigger asChild><Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, 'PPP', { locale: getDateLocale() }) : t('select_date')}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate || undefined} onSelect={(date) => setDueDate(date || null)} initialFocus locale={getDateLocale()} /></PopoverContent></Popover>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Settings2 className="h-4 w-4" />{t('generation_parameters')}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2"><Label>{t('max_lines')}</Label><Input type="number" min="1" max="100" value={maxLines} onChange={(e) => setMaxLines(e.target.value)} /></div>
                      <div className="space-y-2"><Label>{t('min_price_ttc')}</Label><Input type="number" min="0" step="0.001" value={minPriceTtc} onChange={(e) => setMinPriceTtc(e.target.value)} /></div>
                      <div className="space-y-2"><Label>{t('max_price_ttc')}</Label><Input type="number" min="0" step="0.001" value={maxPriceTtc} onChange={(e) => setMaxPriceTtc(e.target.value)} /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('vat_rates_to_use')}</Label>
                      <div className="flex gap-4">{VAT_RATES.map(rate => (<div key={rate} className="flex items-center space-x-2"><Checkbox id={`vat-${rate}`} checked={allowedVatRates.includes(rate)} onCheckedChange={() => handleVatRateToggle(rate)} /><label htmlFor={`vat-${rate}`} className="text-sm font-medium">{rate}%</label></div>))}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" />{t('target_amounts')}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{t('enter_ht_or_ttc_hint')}</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground"><div>{t('vat_rate')}</div><div>{t('total_ht')}</div><div>{t('total_ttc')}</div></div>
                      {vatTargets.map((target, index) => (
                        <div key={target.vatRate} className="grid grid-cols-3 gap-4 items-center">
                          <Badge variant="outline">TVA {target.vatRate}%</Badge>
                          <Input type="number" min="0" step="0.001" placeholder="0.000" value={target.targetHt} onChange={(e) => handleVatTargetChange(index, 'targetHt', e.target.value)} className={cn(target.editMode === 'ht' && target.targetHt && 'border-primary')} />
                          <Input type="number" min="0" step="0.001" placeholder="0.000" value={target.targetTtc} onChange={(e) => handleVatTargetChange(index, 'targetTtc', e.target.value)} className={cn(target.editMode === 'ttc' && target.targetTtc && 'border-primary')} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {!isForeignClient && (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2"><Switch id="stamp-duty" checked={stampDutyEnabled} onCheckedChange={setStampDutyEnabled} /><label htmlFor="stamp-duty" className="text-sm">{t('add_stamp_duty')}</label></div>
                        {stampDutyEnabled && <div className="flex items-center gap-2"><Input type="number" min="0" step="0.001" value={stampDutyAmount} onChange={(e) => setStampDutyAmount(parseFloat(e.target.value) || 0)} className="w-24" /><span className="text-sm text-muted-foreground">DT</span></div>}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card><CardContent className="pt-4"><div className="flex items-center gap-4 text-sm text-muted-foreground"><Package className="h-4 w-4" /><span>{products.length} {t('products_available')}</span><Separator orientation="vertical" className="h-4" /><span>{products.filter(p => allowedVatRates.includes(p.vat_rate)).length} {t('matching_vat_rates')}</span></div></CardContent></Card>
                {generationError && <Card className="border-destructive"><CardContent className="pt-4"><div className="flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" /><span>{generationError}</span></div></CardContent></Card>}
              </motion.div>
            )}

            {step === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="p-6 space-y-6">
                {generationSummary && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" />{t('generation_summary')}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div><span className="text-muted-foreground">{t('lines')}:</span> <span className="font-medium">{generationSummary.lineCount}</span></div>
                        <div><span className="text-muted-foreground">{t('subtotal_ht')}:</span> <span className="font-medium">{generationSummary.subtotalHt.toFixed(3)} DT</span></div>
                        <div><span className="text-muted-foreground">{t('total_vat')}:</span> <span className="font-medium">{generationSummary.totalVat.toFixed(3)} DT</span></div>
                        <div><span className="text-muted-foreground">{t('total_ttc')}:</span> <span className="font-medium">{generationSummary.totalTtc.toFixed(3)} DT</span></div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {stockBubbles.length > 0 && <StockBubbles bubbles={stockBubbles} />}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">{t('generated_lines')} ({generatedLines.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
                    {generatedLines.map((line, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex-1"><span className="font-medium">{line.product_name}</span>{line.product_reference && <span className="text-muted-foreground ml-2">({line.product_reference})</span>}</div>
                        <div className="flex items-center gap-4 text-right"><span>{line.quantity} x {line.unit_price_ht.toFixed(3)} DT</span>{line.discount_percent > 0 && <Badge variant="secondary">-{line.discount_percent}%</Badge>}<Badge variant="outline">TVA {line.vat_rate}%</Badge></div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('subtotal_ht')}</span><span>{formatCurrency(totals.subtotalHt, 'TND')}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('total_vat')}</span><span>{formatCurrency(totals.totalVat, 'TND')}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('total_ttc')}</span><span>{formatCurrency(totals.totalTtc, 'TND')}</span></div>
                    {!isForeignClient && stampDutyEnabled && <div className="flex justify-between"><span className="text-muted-foreground">{t('stamp_duty')}</span><span>{formatCurrency(stampDutyAmount, 'TND')}</span></div>}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold"><span>{t('net_payable')}</span><span className="text-primary">{formatCurrency(totals.totalTtc + (isForeignClient ? 0 : stampDutyEnabled ? stampDutyAmount : 0), 'TND')}</span></div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === 'saving' && (
              <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-full">
                <div className="text-center space-y-4"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="text-lg">{t('saving_invoice')}...</p></div>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        <div className="p-6 pt-0 border-t bg-background">
          <div className="flex justify-between">
            {step === 'config' && (<><Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button><Button onClick={handleGenerate} disabled={isGenerating || !selectedClientId || !invoiceDate || allowedVatRates.length === 0} className="gap-2">{isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" />{t('generating')}...</> : <><Sparkles className="h-4 w-4" />{t('generate_invoice')}</>}</Button></>)}
            {step === 'preview' && (<><Button variant="outline" onClick={() => setStep('config')}>{t('back')}</Button><Button onClick={handleSave} disabled={isSaving || !isNumberValid} className="gap-2">{isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />{t('saving')}...</> : <><CheckCircle2 className="h-4 w-4" />{t('create_invoice')}</>}</Button></>)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
