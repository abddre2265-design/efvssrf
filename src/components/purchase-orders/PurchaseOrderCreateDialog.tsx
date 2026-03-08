import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PurchaseOrderLineForm } from './types';
import { PurchaseOrderNumberInput, generatePONumber } from './PurchaseOrderNumberInput';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export const PurchaseOrderCreateDialog: React.FC<Props> = ({ open, onOpenChange, onCreated }) => {
  const { t } = useLanguage();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [currency, setCurrency] = useState('TND');
  const [notes, setNotes] = useState('');
  const [orderNumber, setOrderNumber] = useState<{ prefix: string; year: number; counter: number; number: string }>({
    prefix: 'BC', year: new Date().getFullYear(), counter: 1, number: '',
  });
  const [numberValid, setNumberValid] = useState(false);
  const [lines, setLines] = useState<PurchaseOrderLineForm[]>([
    { productId: '', name: '', reference: '', quantity: 1, unitPriceHt: 0, vatRate: 19, discountPercent: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: org } = await supabase.from('organizations').select('id').single();
      if (!org) return;
      setOrganizationId(org.id);
      const { data } = await supabase.from('suppliers').select('id, company_name, first_name, last_name').eq('organization_id', org.id);
      setSuppliers(data || []);
    })();
  }, [open]);

  const addLine = () => {
    setLines(prev => [...prev, { productId: '', name: '', reference: '', quantity: 1, unitPriceHt: 0, vatRate: 19, discountPercent: 0 }]);
  };

  const removeLine = (i: number) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, field: keyof PurchaseOrderLineForm, value: any) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const calcLine = (l: PurchaseOrderLineForm) => {
    const ht = l.quantity * l.unitPriceHt * (1 - l.discountPercent / 100);
    const vat = ht * l.vatRate / 100;
    return { ht, vat, ttc: ht + vat };
  };

  const totals = lines.reduce((acc, l) => {
    const c = calcLine(l);
    return { ht: acc.ht + c.ht, vat: acc.vat + c.vat, ttc: acc.ttc + c.ttc };
  }, { ht: 0, vat: 0, ttc: 0 });

  const handleSave = async () => {
    if (!supplierId) {
      toast({ title: t('error') || 'Erreur', description: t('select_supplier') || 'Sélectionnez un fournisseur', variant: 'destructive' });
      return;
    }
    if (!numberValid) {
      toast({ title: t('error') || 'Erreur', description: t('invalid_number') || 'Numéro invalide', variant: 'destructive' });
      return;
    }
    if (lines.some(l => !l.name.trim())) {
      toast({ title: t('error') || 'Erreur', description: t('fill_line_names') || 'Remplissez le nom de chaque ligne', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (!organizationId) throw new Error('No organization');

      const { data: order, error } = await (supabase as any).from('purchase_orders').insert({
        organization_id: organizationId,
        supplier_id: supplierId,
        order_number: orderNumber.number,
        order_prefix: orderNumber.prefix,
        order_year: orderNumber.year,
        order_counter: orderNumber.counter,
        order_date: orderDate,
        expected_delivery_date: expectedDate || null,
        currency,
        exchange_rate: 1,
        subtotal_ht: totals.ht,
        total_vat: totals.vat,
        total_ttc: totals.ttc,
        notes: notes || null,
        status: 'draft',
      }).select().single();

      if (error) throw error;

      const orderLines = lines.map((l, i) => {
        const c = calcLine(l);
        return {
          purchase_order_id: order.id,
          product_id: l.productId || null,
          name: l.name,
          reference: l.reference || null,
          quantity: l.quantity,
          unit_price_ht: l.unitPriceHt,
          vat_rate: l.vatRate,
          discount_percent: l.discountPercent,
          line_total_ht: c.ht,
          line_vat: c.vat,
          line_total_ttc: c.ttc,
          line_order: i,
        };
      });

      const { error: lineErr } = await (supabase as any).from('purchase_order_lines').insert(orderLines);
      if (lineErr) throw lineErr;

      toast({ title: t('success') || 'Succès', description: t('purchase_order_created') || 'Bon de commande créé' });
      onCreated();
      onOpenChange(false);
      // Reset
      setSupplierId('');
      setNotes('');
      setLines([{ productId: '', name: '', reference: '', quantity: 1, unitPriceHt: 0, vatRate: 19, discountPercent: 0 }]);
    } catch (err: any) {
      toast({ title: t('error') || 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getSupplierLabel = (s: any) => s.company_name || `${s.first_name || ''} ${s.last_name || ''}`.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('create_purchase_order') || 'Créer un bon de commande'}</DialogTitle>
        </DialogHeader>

        {/* Numbering section */}
        <PurchaseOrderNumberInput
          orderDate={orderDate}
          organizationId={organizationId}
          value={orderNumber}
          onChange={setOrderNumber}
          onValidityChange={setNumberValid}
        />

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t('supplier') || 'Fournisseur'} *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder={t('select_supplier') || 'Sélectionner...'} /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{getSupplierLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('order_date') || 'Date de commande'}</Label>
            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
          <div>
            <Label>{t('expected_delivery_date') || 'Date de livraison prévue'}</Label>
            <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
          </div>
          <div>
            <Label>{t('currency') || 'Devise'}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TND">TND</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lines */}
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">{t('order_lines') || 'Lignes de commande'}</Label>
            <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
              <Plus className="w-3 h-3" /> {t('add_line') || 'Ajouter'}
            </Button>
          </div>

          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border bg-muted/30">
              <div className="col-span-3">
                <Label className="text-xs">{t('designation') || 'Désignation'} *</Label>
                <Input value={line.name} onChange={e => updateLine(i, 'name', e.target.value)} placeholder="Nom du produit" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{t('reference') || 'Référence'}</Label>
                <Input value={line.reference} onChange={e => updateLine(i, 'reference', e.target.value)} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">{t('quantity') || 'Qté'}</Label>
                <Input type="number" min={1} value={line.quantity} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{t('unit_price_ht') || 'P.U HT'}</Label>
                <Input type="number" min={0} step="0.001" value={line.unitPriceHt} onChange={e => updateLine(i, 'unitPriceHt', Number(e.target.value))} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">{t('vat') || 'TVA %'}</Label>
                <Input type="number" min={0} value={line.vatRate} onChange={e => updateLine(i, 'vatRate', Number(e.target.value))} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">{t('discount') || 'Rem %'}</Label>
                <Input type="number" min={0} max={100} value={line.discountPercent} onChange={e => updateLine(i, 'discountPercent', Number(e.target.value))} />
              </div>
              <div className="col-span-1 text-right text-sm font-medium pt-5">
                {calcLine(line).ttc.toFixed(3)}
              </div>
              <div className="col-span-1 flex justify-end pt-5">
                <Button variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={lines.length <= 1}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="space-y-1 text-sm w-64">
            <div className="flex justify-between"><span>{t('subtotal_ht') || 'Total HT'}</span><span className="font-medium">{totals.ht.toFixed(3)} {currency}</span></div>
            <div className="flex justify-between"><span>{t('total_vat') || 'Total TVA'}</span><span className="font-medium">{totals.vat.toFixed(3)} {currency}</span></div>
            <div className="flex justify-between border-t pt-1 font-bold"><span>{t('total_ttc') || 'Total TTC'}</span><span>{totals.ttc.toFixed(3)} {currency}</span></div>
          </div>
        </div>

        <div>
          <Label>{t('notes') || 'Notes'}</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel') || 'Annuler'}</Button>
          <Button onClick={handleSave} disabled={saving || !numberValid}>
            {saving ? (t('saving') || 'Enregistrement...') : (t('save') || 'Enregistrer')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
