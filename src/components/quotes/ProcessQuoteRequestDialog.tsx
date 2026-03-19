import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Package, Loader2, Check, ArrowRight, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QuoteRequest, QuoteRequestItem } from '@/components/quote-requests/types';
import { QUOTE_PREFIXES, generateQuoteNumber } from './types';
import { calculateLineTotal, formatCurrency } from '@/components/invoices/types';
import { useTaxRates } from '@/hooks/useTaxRates';

interface ProcessQuoteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: QuoteRequest | null;
  items: QuoteRequestItem[];
  organizationId: string;
  onCreated: () => void;
}

interface ProductMatch {
  requestItemId: string;
  requestDescription: string;
  requestQuantity: number;
  productId: string | null;
  productName: string;
  productReference: string | null;
  unitPriceHt: number;
  vatRate: number;
  quantity: number;
  discountPercent: number;
  isNew: boolean;
}

interface SearchProduct {
  id: string;
  name: string;
  reference: string | null;
  price_ht: number;
  vat_rate: number;
}

export const ProcessQuoteRequestDialog: React.FC<ProcessQuoteRequestDialogProps> = ({
  open,
  onOpenChange,
  request,
  items,
  organizationId,
  onCreated,
}) => {
  const { t, language, isRTL } = useLanguage();
  const { vatRates } = useTaxRates(organizationId);
  const [matches, setMatches] = useState<ProductMatch[]>([]);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, SearchProduct[]>>({});
  const [isSearching, setIsSearching] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [stampDutyEnabled, setStampDutyEnabled] = useState(true);
  const [stampDutyAmount, setStampDutyAmount] = useState(1);
  const [notes, setNotes] = useState('');

  // Initialize matches from request items
  useEffect(() => {
    if (items.length > 0 && open) {
      setMatches(items.map(item => ({
        requestItemId: item.id,
        requestDescription: item.description,
        requestQuantity: item.quantity || 1,
        productId: null,
        productName: '',
        productReference: null,
        unitPriceHt: 0,
        vatRate: 19,
        quantity: item.quantity || 1,
        discountPercent: 0,
        isNew: false,
      })));
    }
  }, [items, open]);

  const searchProducts = useCallback(async (itemId: string, query: string) => {
    if (!query || query.length < 2) {
      setSearchResults(prev => ({ ...prev, [itemId]: [] }));
      return;
    }
    setIsSearching(prev => ({ ...prev, [itemId]: true }));
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, reference, price_ht, vat_rate')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .or(`name.ilike.%${query}%,reference.ilike.%${query}%`)
        .limit(10);
      setSearchResults(prev => ({ ...prev, [itemId]: (data as SearchProduct[]) || [] }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(prev => ({ ...prev, [itemId]: false }));
    }
  }, [organizationId]);

  const handleSelectProduct = (itemId: string, product: SearchProduct) => {
    setMatches(prev => prev.map(m => 
      m.requestItemId === itemId ? {
        ...m,
        productId: product.id,
        productName: product.name,
        productReference: product.reference,
        unitPriceHt: product.price_ht,
        vatRate: product.vat_rate,
        isNew: false,
      } : m
    ));
    setSearchResults(prev => ({ ...prev, [itemId]: [] }));
    setSearchQueries(prev => ({ ...prev, [itemId]: '' }));
  };

  const handleRemoveMatch = (itemId: string) => {
    setMatches(prev => prev.filter(m => m.requestItemId !== itemId));
  };

  const handleFieldChange = (itemId: string, field: keyof ProductMatch, value: any) => {
    setMatches(prev => prev.map(m => 
      m.requestItemId === itemId ? { ...m, [field]: value } : m
    ));
  };

  // Calculate totals
  const totals = matches.reduce((acc, m) => {
    if (!m.productId) return acc;
    const { lineHt, lineVat, lineTtc } = calculateLineTotal(m.quantity, m.unitPriceHt, m.vatRate, m.discountPercent, false);
    return {
      subtotalHt: acc.subtotalHt + lineHt,
      totalVat: acc.totalVat + lineVat,
      totalTtc: acc.totalTtc + lineTtc,
      totalDiscount: acc.totalDiscount + (m.quantity * m.unitPriceHt * m.discountPercent / 100),
    };
  }, { subtotalHt: 0, totalVat: 0, totalTtc: 0, totalDiscount: 0 });

  const netPayable = totals.totalTtc + (stampDutyEnabled ? stampDutyAmount : 0);

  const handleSave = async () => {
    const linkedMatches = matches.filter(m => m.productId);
    if (linkedMatches.length === 0) {
      toast.error(t('link_at_least_one_product'));
      return;
    }

    setIsSaving(true);
    try {
      const prefix = QUOTE_PREFIXES[language as keyof typeof QUOTE_PREFIXES] || QUOTE_PREFIXES.fr;
      const currentYear = new Date().getFullYear();

      // Get next counter
      const { data: lastQuote } = await supabase
        .from('quotes')
        .select('quote_counter')
        .eq('organization_id', organizationId)
        .eq('quote_year', currentYear)
        .order('quote_counter', { ascending: false })
        .limit(1);

      const nextCounter = (lastQuote && lastQuote.length > 0 ? (lastQuote[0] as any).quote_counter : 0) + 1;
      const quoteNumber = generateQuoteNumber(prefix, currentYear, nextCounter);

      // Find or reference client
      let clientId = request?.client_id || null;

      // Create the quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          organization_id: organizationId,
          client_id: clientId,
          quote_request_id: request?.id,
          quote_number: quoteNumber,
          quote_prefix: prefix,
          quote_year: currentYear,
          quote_counter: nextCounter,
          quote_date: new Date().toISOString().split('T')[0],
          validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          client_type: request?.client_type || 'person',
          subtotal_ht: totals.subtotalHt,
          total_vat: totals.totalVat,
          total_discount: totals.totalDiscount,
          total_ttc: totals.totalTtc,
          stamp_duty_enabled: stampDutyEnabled,
          stamp_duty_amount: stampDutyEnabled ? stampDutyAmount : 0,
          net_payable: netPayable,
          status: 'draft',
          notes,
        } as any)
        .select('id')
        .single();

      if (quoteError) throw quoteError;

      // Create quote lines
      const lines = linkedMatches.map((m, idx) => {
        const { lineHt, lineVat, lineTtc } = calculateLineTotal(m.quantity, m.unitPriceHt, m.vatRate, m.discountPercent, false);
        return {
          quote_id: (quoteData as any).id,
          product_id: m.productId,
          description: m.requestDescription,
          quantity: m.quantity,
          unit_price_ht: m.unitPriceHt,
          vat_rate: m.vatRate,
          discount_percent: m.discountPercent,
          line_total_ht: lineHt,
          line_vat: lineVat,
          line_total_ttc: lineTtc,
          line_order: idx,
        };
      });

      const { error: linesError } = await supabase.from('quote_lines').insert(lines as any);
      if (linesError) throw linesError;

      // Update quote request status
      if (request?.id) {
        await supabase
          .from('quote_requests')
          .update({ status: 'completed' })
          .eq('id', request.id);
      }

      toast.success(t('quote_created_successfully'));
      onCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating quote:', error);
      toast.error(t('error_creating_quote'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('process_quote_request')} — {request.request_number}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="space-y-6 pr-4">
            {/* Client info summary */}
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('client')}:</span>
                    <span className="ml-2 font-medium">
                      {request.company_name || `${request.first_name || ''} ${request.last_name || ''}`.trim() || t('unknown_client')}
                    </span>
                  </div>
                  {request.email && (
                    <div>
                      <span className="text-muted-foreground">{t('email')}:</span>
                      <span className="ml-2">{request.email}</span>
                    </div>
                  )}
                  {request.phone && (
                    <div>
                      <span className="text-muted-foreground">{t('phone')}:</span>
                      <span className="ml-2">{request.phone_prefix} {request.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Product matching */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t('link_products')}</h3>
              
              {matches.map((match) => (
                <Card key={match.requestItemId} className="relative">
                  <CardContent className="pt-4 space-y-3">
                    {/* Original request */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{t('requested')}</Badge>
                        <span className="font-medium">{match.requestDescription}</span>
                        {match.requestQuantity > 0 && (
                          <span className="text-sm text-muted-foreground">× {match.requestQuantity}</span>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveMatch(match.requestItemId)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ArrowRight className="h-4 w-4" />
                      <span className="text-xs">{t('link_to_product')}</span>
                    </div>

                    {/* Product search / linked product */}
                    {!match.productId ? (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={t('search_product_by_name_or_ref')}
                          value={searchQueries[match.requestItemId] || ''}
                          onChange={(e) => {
                            setSearchQueries(prev => ({ ...prev, [match.requestItemId]: e.target.value }));
                            searchProducts(match.requestItemId, e.target.value);
                          }}
                          className="pl-10"
                        />
                        {isSearching[match.requestItemId] && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                        )}
                        {(searchResults[match.requestItemId] || []).length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                            {searchResults[match.requestItemId].map(p => (
                              <button
                                key={p.id}
                                onClick={() => handleSelectProduct(match.requestItemId, p)}
                                className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between text-sm"
                              >
                                <div>
                                  <span className="font-medium">{p.name}</span>
                                  {p.reference && <span className="ml-2 text-muted-foreground">[{p.reference}]</span>}
                                </div>
                                <span className="font-mono text-xs">{formatCurrency(p.price_ht, 'TND')}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{match.productName}</span>
                          {match.productReference && (
                            <Badge variant="secondary" className="text-xs">{match.productReference}</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFieldChange(match.requestItemId, 'productId', null)}
                            className="text-xs"
                          >
                            {t('change')}
                          </Button>
                        </div>

                        {/* Editable fields */}
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">{t('quantity')}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={match.quantity}
                              onChange={(e) => handleFieldChange(match.requestItemId, 'quantity', parseFloat(e.target.value) || 1)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('unit_price_ht')}</Label>
                            <Input
                              type="number"
                              step="0.001"
                              value={match.unitPriceHt}
                              onChange={(e) => handleFieldChange(match.requestItemId, 'unitPriceHt', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('vat_rate')}</Label>
                            <Select
                              value={String(match.vatRate)}
                              onValueChange={(v) => handleFieldChange(match.requestItemId, 'vatRate', parseFloat(v))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(vatRates.length > 0 ? vatRates : [0, 7, 13, 19]).map(rate => (
                                  <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">{t('discount')} %</Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={match.discountPercent}
                              onChange={(e) => handleFieldChange(match.requestItemId, 'discountPercent', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>

                        {/* Line total preview */}
                        {(() => {
                          const { lineHt, lineVat, lineTtc } = calculateLineTotal(match.quantity, match.unitPriceHt, match.vatRate, match.discountPercent, false);
                          return (
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>HT: {formatCurrency(lineHt, 'TND')}</span>
                              <span>TVA: {formatCurrency(lineVat, 'TND')}</span>
                              <span className="font-medium text-foreground">TTC: {formatCurrency(lineTtc, 'TND')}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator />

            {/* Stamp duty & totals */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch checked={stampDutyEnabled} onCheckedChange={setStampDutyEnabled} />
                  <Label>{t('stamp_duty')}</Label>
                  {stampDutyEnabled && (
                    <Input
                      type="number"
                      step="0.001"
                      value={stampDutyAmount}
                      onChange={(e) => setStampDutyAmount(parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                  )}
                </div>
                <div>
                  <Label className="text-xs">{t('notes')}</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('optional_notes')}
                  />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('subtotal_ht')}</span>
                  <span className="font-mono">{formatCurrency(totals.subtotalHt, 'TND')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('total_vat')}</span>
                  <span className="font-mono">{formatCurrency(totals.totalVat, 'TND')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('total_ttc')}</span>
                  <span className="font-mono">{formatCurrency(totals.totalTtc, 'TND')}</span>
                </div>
                {stampDutyEnabled && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('stamp_duty')}</span>
                    <span className="font-mono">{formatCurrency(stampDutyAmount, 'TND')}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>{t('net_payable')}</span>
                  <span className="font-mono text-primary">{formatCurrency(netPayable, 'TND')}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || matches.filter(m => m.productId).length === 0}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('create_quote')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
