import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, ShoppingBag, Package, AlertTriangle, X, Check, FileText } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReservationWithProduct {
  id: string;
  product_id: string;
  client_id: string;
  quantity: number;
  expiration_date: string | null;
  status: string;
  notes: string | null;
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
}

export interface SelectedReservationForInvoice {
  reservationId: string;
  productId: string;
  productName: string;
  productReference: string | null;
  priceHt: number;
  vatRate: number;
  maxDiscount: number | null;
  quantity: number;
  currentStock: number | null;
  unlimitedStock: boolean;
  allowOutOfStockSale: boolean | null;
  reservedStock: number;
}

interface ClientOtherReservationsDialogProps {
  clientId: string | null;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alreadySelectedIds: string[];
  onUseReservation: (reservation: SelectedReservationForInvoice) => void;
  onCancelReservation: (reservationId: string) => void;
  onGoToInvoice: () => void;
  selectedCount: number;
}

export const ClientOtherReservationsDialog: React.FC<ClientOtherReservationsDialogProps> = ({
  clientId,
  clientName,
  open,
  onOpenChange,
  alreadySelectedIds,
  onUseReservation,
  onCancelReservation,
  onGoToInvoice,
  selectedCount,
}) => {
  const { t, language } = useLanguage();
  const [reservations, setReservations] = useState<ReservationWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ReservationWithProduct | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  useEffect(() => {
    const fetchReservations = async () => {
      if (!open || !clientId) return;
      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('product_reservations')
          .select(`
            id, product_id, client_id, quantity, expiration_date, status, notes,
            product:products(id, name, reference, price_ht, vat_rate, max_discount, current_stock, unlimited_stock, allow_out_of_stock_sale, reserved_stock)
          `)
          .eq('client_id', clientId)
          .in('status', ['active', 'expired'])
          .order('created_at', { ascending: false });

        if (error) throw error;
        // Filter out already selected ones
        const filtered = (data as ReservationWithProduct[]).filter(
          r => !alreadySelectedIds.includes(r.id)
        );
        setReservations(filtered);
      } catch (error) {
        console.error('Fetch client reservations error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, [open, clientId, alreadySelectedIds]);

  const isExpired = (r: ReservationWithProduct) => {
    if (!r.expiration_date) return false;
    return isPast(parseISO(r.expiration_date));
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('product_reservations')
        .update({ status: 'cancelled' })
        .eq('id', cancelTarget.id);
      if (error) throw error;

      // Update reserved_stock
      if (!cancelTarget.product.unlimited_stock) {
        const newReserved = Math.max(0, (cancelTarget.product.reserved_stock ?? 0) - cancelTarget.quantity);
        await supabase.from('products').update({ reserved_stock: newReserved }).eq('id', cancelTarget.product_id);
      }

      toast.success(t('reservation_cancelled'));
      onCancelReservation(cancelTarget.id);
      setReservations(prev => prev.filter(r => r.id !== cancelTarget.id));
      setCancelTarget(null);
    } catch (error: any) {
      toast.error(error.message || t('genericError'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUse = (r: ReservationWithProduct) => {
    onUseReservation({
      reservationId: r.id,
      productId: r.product.id,
      productName: r.product.name,
      productReference: r.product.reference,
      priceHt: r.product.price_ht,
      vatRate: r.product.vat_rate,
      maxDiscount: r.product.max_discount,
      quantity: r.quantity,
      currentStock: r.product.current_stock,
      unlimitedStock: r.product.unlimited_stock,
      allowOutOfStockSale: r.product.allow_out_of_stock_sale,
      reservedStock: r.product.reserved_stock,
    });
    setReservations(prev => prev.filter(rv => rv.id !== r.id));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              {t('other_reservations_of')} {clientName}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : reservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mb-2 opacity-50" />
                <p>{t('no_other_reservations')}</p>
              </div>
            ) : (
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {reservations.map((r) => {
                    const expired = isExpired(r);
                    return (
                      <div
                        key={r.id}
                        className={`p-3 rounded-lg border ${
                          expired ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card border-border/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{r.product.name}</span>
                              {expired && (
                                <Badge variant="outline" className="text-amber-600 border-amber-500 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {t('expired')}
                                </Badge>
                              )}
                            </div>
                            {r.product.reference && (
                              <p className="text-xs text-muted-foreground font-mono">{r.product.reference}</p>
                            )}
                            <div className="mt-1 text-sm text-muted-foreground">
                              <p>{t('quantity')}: {r.quantity} | {t('price')}: {r.product.price_ht.toFixed(3)} TND</p>
                              {r.expiration_date && (
                                <p className="text-xs">
                                  {t('expires')}: {format(parseISO(r.expiration_date), 'PP', { locale: getDateLocale() })}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-1 ml-2 shrink-0">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 gap-1"
                              onClick={() => handleUse(r)}
                            >
                              <Check className="h-3 w-3" />
                              {t('use')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-destructive hover:text-destructive"
                              onClick={() => setCancelTarget(r)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button onClick={onGoToInvoice} className="gap-2">
              <FileText className="h-4 w-4" />
              {t('go_to_invoice_creation')} {selectedCount > 0 && `(${selectedCount})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancel_reservation')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cancel_reservation_confirm')}
              <br />
              <span className="font-medium">
                {cancelTarget?.product.name} - {cancelTarget?.quantity} {t('units')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>{t('no')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={isCancelling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('yes_cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
