import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, Truck } from 'lucide-react';
import { formatCurrency } from '@/components/invoices/types';

interface PurchaseDoc {
  id: string;
  invoice_number: string | null;
  supplier_id: string | null;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  stamp_duty_amount: number;
  net_payable: number;
  total_credited: number;
}

interface PurchaseLine {
  id: string;
  name: string;
  reference: string | null;
  product_id: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
}

interface LineDiscount {
  purchase_line_id: string;
  discount_ht: number;
  discount_rate: number;
  returned_quantity: number;
}

interface PurchaseCreditNoteCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseDocumentId?: string;
  onComplete: () => void;
}

export const PurchaseCreditNoteCreateDialog: React.FC<PurchaseCreditNoteCreateDialogProps> = ({
  open,
  onOpenChange,
  purchaseDocumentId,
  onComplete,
}) => {
  const { t, isRTL } = useLanguage();
  const [step, setStep] = useState<'select_doc' | 'select_type' | 'form'>('select_doc');
  const [purchaseDocs, setPurchaseDocs] = useState<PurchaseDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(purchaseDocumentId || null);
  const [selectedDoc, setSelectedDoc] = useState<PurchaseDoc | null>(null);
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([]);
  const [supplier, setSupplier] = useState<any>(null);
  const [creditNoteType, setCreditNoteType] = useState<'commercial_price' | 'product_return'>('commercial_price');
  const [method, setMethod] = useState<'lines' | 'total'>('lines');
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, LineDiscount>>({});
  const [totalDiscountPercent, setTotalDiscountPercent] = useState(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Load purchase documents
  useEffect(() => {
    if (!open) return;
    const loadDocs = async () => {
      setIsLoadingDocs(true);
      const { data } = await supabase
        .from('purchase_documents')
        .select('id, invoice_number, supplier_id, subtotal_ht, total_vat, total_ttc, stamp_duty_amount, net_payable, total_credited')
        .eq('status', 'validated')
        .order('created_at', { ascending: false });
      setPurchaseDocs((data || []) as unknown as PurchaseDoc[]);
      setIsLoadingDocs(false);
    };
    loadDocs();
  }, [open]);

  // When doc selected, load lines and supplier
  useEffect(() => {
    if (!selectedDocId) return;
    const doc = purchaseDocs.find(d => d.id === selectedDocId);
    setSelectedDoc(doc || null);

    const loadDetails = async () => {
      const [linesRes, supplierRes] = await Promise.all([
        supabase.from('purchase_lines').select('*').eq('purchase_document_id', selectedDocId).order('line_order'),
        doc?.supplier_id
          ? supabase.from('suppliers').select('id, supplier_type, first_name, last_name, company_name').eq('id', doc.supplier_id).single()
          : Promise.resolve({ data: null }),
      ]);
      setPurchaseLines((linesRes.data || []) as unknown as PurchaseLine[]);
      setSupplier(supplierRes.data);

      // Init line discounts
      const discounts: Record<string, LineDiscount> = {};
      (linesRes.data || []).forEach((l: any) => {
        discounts[l.id] = { purchase_line_id: l.id, discount_ht: 0, discount_rate: 0, returned_quantity: 0 };
      });
      setLineDiscounts(discounts);
    };
    loadDetails();
  }, [selectedDocId, purchaseDocs]);

  // Skip doc selection if provided
  useEffect(() => {
    if (purchaseDocumentId && open) {
      setSelectedDocId(purchaseDocumentId);
      setStep('select_type');
    } else if (open) {
      setStep('select_doc');
    }
  }, [purchaseDocumentId, open]);

  // Calculate totals
  const calculatedTotals = useMemo(() => {
    if (!selectedDoc) return { subtotalHt: 0, totalVat: 0, totalTtc: 0, newNetPayable: 0 };

    let newSubtotalHt = 0;
    let newTotalVat = 0;
    let newTotalTtc = 0;

    if (creditNoteType === 'commercial_price' && method === 'total') {
      const discountFactor = 1 - (totalDiscountPercent / 100);
      newSubtotalHt = selectedDoc.subtotal_ht * discountFactor;
      newTotalVat = selectedDoc.total_vat * discountFactor;
      newTotalTtc = selectedDoc.total_ttc * discountFactor;
    } else {
      purchaseLines.forEach(line => {
        const ld = lineDiscounts[line.id];
        if (creditNoteType === 'product_return') {
          const returnedQty = ld?.returned_quantity || 0;
          const remainingQty = line.quantity - returnedQty;
          const lineHt = line.unit_price_ht * remainingQty;
          const lineVat = lineHt * (line.vat_rate / 100);
          newSubtotalHt += lineHt;
          newTotalVat += lineVat;
          newTotalTtc += lineHt + lineVat;
        } else {
          const discountRate = ld?.discount_rate || 0;
          const lineHt = line.line_total_ht * (1 - discountRate / 100);
          const lineVat = lineHt * (line.vat_rate / 100);
          newSubtotalHt += lineHt;
          newTotalVat += lineVat;
          newTotalTtc += lineHt + lineVat;
        }
      });
    }

    const newNetPayable = newTotalTtc + selectedDoc.stamp_duty_amount;

    return { subtotalHt: newSubtotalHt, totalVat: newTotalVat, totalTtc: newTotalTtc, newNetPayable };
  }, [selectedDoc, purchaseLines, lineDiscounts, creditNoteType, method, totalDiscountPercent]);

  const handleLineDiscountChange = (lineId: string, field: 'discount_rate' | 'returned_quantity', value: number) => {
    setLineDiscounts(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value },
    }));
  };

  const handleSubmit = async () => {
    if (!selectedDoc || !supplier) return;
    setIsSubmitting(true);

    try {
      // Get org
      const { data: org } = await supabase.from('organizations').select('id').limit(1).single();
      if (!org) throw new Error('No organization');

      // Get next counter
      const currentYear = new Date().getFullYear();
      const { data: lastCn } = await supabase
        .from('purchase_credit_notes')
        .select('credit_note_counter')
        .eq('credit_note_year', currentYear)
        .order('credit_note_counter', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextCounter = ((lastCn as any)?.credit_note_counter || 0) + 1;
      const cnNumber = `AVA-${currentYear}-${String(nextCounter).padStart(5, '0')}`;

      // Create credit note
      const { data: cn, error: cnError } = await supabase
        .from('purchase_credit_notes')
        .insert({
          organization_id: org.id,
          purchase_document_id: selectedDoc.id,
          supplier_id: supplier.id,
          credit_note_number: cnNumber,
          credit_note_prefix: 'AVA',
          credit_note_year: currentYear,
          credit_note_counter: nextCounter,
          credit_note_type: creditNoteType,
          credit_note_method: method,
          subtotal_ht: calculatedTotals.subtotalHt,
          total_vat: calculatedTotals.totalVat,
          total_ttc: calculatedTotals.totalTtc,
          stamp_duty_amount: selectedDoc.stamp_duty_amount,
          original_net_payable: selectedDoc.net_payable,
          new_net_payable: calculatedTotals.newNetPayable,
          status: 'created',
          reason,
          notes,
        } as any)
        .select()
        .single();

      if (cnError) throw cnError;

      // Create lines
      const cnLines = purchaseLines.map((line, idx) => {
        const ld = lineDiscounts[line.id];
        let discountHt = 0;
        let discountTtc = 0;
        let discountRate = 0;
        let returnedQty = 0;
        let newLineHt = line.line_total_ht;
        let newLineVat = line.line_vat;
        let newLineTtc = line.line_total_ttc;

        if (creditNoteType === 'product_return') {
          returnedQty = ld?.returned_quantity || 0;
          const remainingQty = line.quantity - returnedQty;
          newLineHt = line.unit_price_ht * remainingQty;
          newLineVat = newLineHt * (line.vat_rate / 100);
          newLineTtc = newLineHt + newLineVat;
          discountHt = line.line_total_ht - newLineHt;
          discountTtc = line.line_total_ttc - newLineTtc;
          discountRate = line.line_total_ht > 0 ? (discountHt / line.line_total_ht) * 100 : 0;
        } else if (method === 'total') {
          discountRate = totalDiscountPercent;
          discountHt = line.line_total_ht * (discountRate / 100);
          newLineHt = line.line_total_ht - discountHt;
          newLineVat = newLineHt * (line.vat_rate / 100);
          newLineTtc = newLineHt + newLineVat;
          discountTtc = line.line_total_ttc - newLineTtc;
        } else {
          discountRate = ld?.discount_rate || 0;
          discountHt = line.line_total_ht * (discountRate / 100);
          newLineHt = line.line_total_ht - discountHt;
          newLineVat = newLineHt * (line.vat_rate / 100);
          newLineTtc = newLineHt + newLineVat;
          discountTtc = line.line_total_ttc - newLineTtc;
        }

        return {
          credit_note_id: (cn as any).id,
          purchase_line_id: line.id,
          product_id: line.product_id,
          product_name: line.name,
          product_reference: line.reference,
          original_quantity: line.quantity,
          original_unit_price_ht: line.unit_price_ht,
          original_line_total_ht: line.line_total_ht,
          original_line_vat: line.line_vat,
          original_line_total_ttc: line.line_total_ttc,
          returned_quantity: returnedQty,
          validated_quantity: 0,
          discount_ht: discountHt,
          discount_ttc: discountTtc,
          discount_rate: discountRate,
          new_line_total_ht: newLineHt,
          new_line_vat: newLineVat,
          new_line_total_ttc: newLineTtc,
          vat_rate: line.vat_rate,
          line_order: idx,
        };
      });

      const { error: linesError } = await supabase
        .from('purchase_credit_note_lines')
        .insert(cnLines as any);
      if (linesError) throw linesError;

      toast.success(t('purchase_credit_note_created') || 'Avoir d\'achat créé avec succès');
      onComplete();
      onOpenChange(false);

      // Reset
      setStep('select_doc');
      setSelectedDocId(null);
      setReason('');
      setNotes('');
      setTotalDiscountPercent(0);
    } catch (error) {
      console.error('Error creating purchase credit note:', error);
      toast.error(t('error_creating_credit_note') || 'Erreur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSupplierName = () => {
    if (!supplier) return '-';
    return supplier.company_name || `${supplier.first_name || ''} ${supplier.last_name || ''}`.trim() || '-';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] max-h-[90vh] p-0 overflow-hidden grid grid-rows-[auto,1fr]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('create_purchase_credit_note') || 'Créer un avoir d\'achat'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          <div className="p-6 space-y-6">
            {/* Step 1: Select purchase document */}
            {step === 'select_doc' && (
              <div className="space-y-4">
                <h3 className="font-semibold">{t('select_purchase_invoice') || 'Sélectionner la facture d\'achat'}</h3>
                <Select value={selectedDocId || ''} onValueChange={(v) => setSelectedDocId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_purchase_invoice') || 'Sélectionner...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseDocs.map(doc => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.invoice_number || doc.id.slice(0, 8)} — {formatCurrency(doc.net_payable, 'TND')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  <Button onClick={() => setStep('select_type')} disabled={!selectedDocId}>
                    {t('next') || 'Suivant'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Select type */}
            {step === 'select_type' && (
              <div className="space-y-4">
                <h3 className="font-semibold">{t('purchase_credit_note_type') || 'Type d\'avoir'}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    className={`p-6 rounded-lg border-2 text-center space-y-2 transition-all ${
                      creditNoteType === 'commercial_price' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => setCreditNoteType('commercial_price')}
                  >
                    <div className="text-lg font-semibold">{t('credit_note_commercial_price')}</div>
                    <p className="text-sm text-muted-foreground">{t('purchase_commercial_price_description') || 'Réduction de prix négociée'}</p>
                  </button>
                  <button
                    className={`p-6 rounded-lg border-2 text-center space-y-2 transition-all ${
                      creditNoteType === 'product_return' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => setCreditNoteType('product_return')}
                  >
                    <div className="text-lg font-semibold">{t('credit_note_product') || 'Avoir produit'}</div>
                    <p className="text-sm text-muted-foreground">{t('product_return_description') || 'Retour de marchandise au fournisseur'}</p>
                  </button>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('select_doc')}>
                    {t('back') || 'Retour'}
                  </Button>
                  <Button onClick={() => setStep('form')}>
                    {t('next') || 'Suivant'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Form */}
            {step === 'form' && selectedDoc && (
              <div className="space-y-6">
                {/* Doc & Supplier info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-2 text-primary font-medium mb-2">
                      <FileText className="h-4 w-4" />
                      {t('purchase_invoice') || 'Facture achat'}
                    </div>
                    <p className="font-mono font-medium">{selectedDoc.invoice_number || '-'}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('net_payable')}: {formatCurrency(selectedDoc.net_payable, 'TND')}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-2 text-primary font-medium mb-2">
                      <Truck className="h-4 w-4" />
                      {t('supplier') || 'Fournisseur'}
                    </div>
                    <p className="font-semibold">{getSupplierName()}</p>
                  </div>
                </div>

                {/* Method selection for commercial */}
                {creditNoteType === 'commercial_price' && (
                  <div>
                    <Label>{t('method') || 'Méthode'}</Label>
                    <Tabs value={method} onValueChange={(v) => setMethod(v as 'lines' | 'total')} className="mt-2">
                      <TabsList>
                        <TabsTrigger value="lines">{t('mode_line_discount')}</TabsTrigger>
                        <TabsTrigger value="total">{t('mode_total_discount')}</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                )}

                <Separator />

                {/* Total discount mode */}
                {creditNoteType === 'commercial_price' && method === 'total' && (
                  <div className="space-y-2">
                    <Label>{t('discount_rate') || 'Taux de remise'} (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={totalDiscountPercent}
                      onChange={(e) => setTotalDiscountPercent(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}

                {/* Lines */}
                {(creditNoteType === 'product_return' || (creditNoteType === 'commercial_price' && method === 'lines')) && (
                  <div className="space-y-3">
                    <h4 className="font-medium">{t('invoice_lines')}</h4>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-start p-3 font-medium">{t('product')}</th>
                            <th className="text-end p-3 font-medium">{t('quantity')}</th>
                            <th className="text-end p-3 font-medium">HT</th>
                            <th className="text-end p-3 font-medium">{t('vat')}</th>
                            <th className="text-center p-3 font-medium">
                              {creditNoteType === 'product_return' ? (t('returned_quantity') || 'Qté retournée') : (t('discount_rate') || 'Remise %')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchaseLines.map((line, idx) => (
                            <tr key={line.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                              <td className="p-3">
                                <div className="font-medium">{line.name}</div>
                                {line.reference && <div className="text-xs text-muted-foreground font-mono">{line.reference}</div>}
                              </td>
                              <td className="text-end p-3">{line.quantity}</td>
                              <td className="text-end p-3 font-mono">{formatCurrency(line.line_total_ht, 'TND')}</td>
                              <td className="text-end p-3">{line.vat_rate}%</td>
                              <td className="p-3">
                                <Input
                                  type="number"
                                  min={0}
                                  max={creditNoteType === 'product_return' ? line.quantity : 100}
                                  step={creditNoteType === 'product_return' ? 1 : 0.01}
                                  className="w-24 mx-auto text-center"
                                  value={creditNoteType === 'product_return' ? (lineDiscounts[line.id]?.returned_quantity || 0) : (lineDiscounts[line.id]?.discount_rate || 0)}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    handleLineDiscountChange(
                                      line.id,
                                      creditNoteType === 'product_return' ? 'returned_quantity' : 'discount_rate',
                                      val
                                    );
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Totals */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 bg-muted/20">
                    <h4 className="font-semibold text-sm mb-2">{t('original_totals')}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">HT</span>
                        <span className="font-mono">{formatCurrency(selectedDoc.subtotal_ht, 'TND')}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>TTC</span>
                        <span className="font-mono">{formatCurrency(selectedDoc.total_ttc, 'TND')}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>{t('net_payable')}</span>
                        <span className="font-mono text-primary">{formatCurrency(selectedDoc.net_payable, 'TND')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
                    <h4 className="font-semibold text-sm mb-2">{t('new_totals')}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">HT</span>
                        <span className="font-mono">{formatCurrency(calculatedTotals.subtotalHt, 'TND')}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>TTC</span>
                        <span className="font-mono">{formatCurrency(calculatedTotals.totalTtc, 'TND')}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-base">
                        <span>{t('new_net_payable')}</span>
                        <span className="font-mono text-primary">{formatCurrency(calculatedTotals.newNetPayable, 'TND')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason & Notes */}
                <div className="space-y-3">
                  <div>
                    <Label>{t('reason') || 'Motif'}</Label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>{t('notes')}</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep('select_type')}>
                    {t('back') || 'Retour'}
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('creating') || 'Création...'}
                      </>
                    ) : (
                      t('create') || 'Créer'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
