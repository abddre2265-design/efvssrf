import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ShoppingBag, AlertTriangle, Package } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface Reservation {
  id: string;
  product_id: string;
  quantity: number;
  expiration_date: string | null;
  status: string;
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

interface SelectedReservation {
  reservation: Reservation;
  quantityToUse: number;
}

interface ClientReservationsDialogProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddReservations: (reservations: SelectedReservation[]) => void;
}

export const ClientReservationsDialog: React.FC<ClientReservationsDialogProps> = ({
  clientId,
  open,
  onOpenChange,
  onAddReservations,
}) => {
  const { t, language } = useLanguage();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReservations, setSelectedReservations] = useState<Map<string, number>>(new Map());

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  // Fetch reservations for client
  useEffect(() => {
    const fetchReservations = async () => {
      if (!open || !clientId) return;
      setIsLoading(true);
      setSelectedReservations(new Map());

      try {
        const { data, error } = await supabase
          .from('product_reservations')
          .select(`
            id,
            product_id,
            quantity,
            expiration_date,
            status,
            product:products(
              id,
              name,
              reference,
              price_ht,
              vat_rate,
              max_discount,
              current_stock,
              unlimited_stock,
              allow_out_of_stock_sale,
              reserved_stock
            )
          `)
          .eq('client_id', clientId)
          .in('status', ['active', 'expired'])
          .order('created_at', { ascending: false });

        if (error) throw error;
        setReservations(data as Reservation[]);
      } catch (error) {
        console.error('Fetch reservations error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, [open, clientId]);

  const isExpired = (reservation: Reservation): boolean => {
    if (!reservation.expiration_date) return false;
    return isPast(parseISO(reservation.expiration_date));
  };

  const handleToggleReservation = (reservationId: string, maxQuantity: number) => {
    setSelectedReservations((prev) => {
      const next = new Map(prev);
      if (next.has(reservationId)) {
        next.delete(reservationId);
      } else {
        next.set(reservationId, maxQuantity);
      }
      return next;
    });
  };

  const handleQuantityChange = (reservationId: string, quantity: number, maxQuantity: number) => {
    setSelectedReservations((prev) => {
      const next = new Map(prev);
      next.set(reservationId, Math.min(Math.max(1, quantity), maxQuantity));
      return next;
    });
  };

  const handleAddSelected = () => {
    const selected: SelectedReservation[] = [];
    
    selectedReservations.forEach((quantityToUse, reservationId) => {
      const reservation = reservations.find(r => r.id === reservationId);
      if (reservation) {
        selected.push({ reservation, quantityToUse });
      }
    });

    onAddReservations(selected);
    onOpenChange(false);
  };

  const hasSelections = selectedReservations.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            {t('client_reservations')}
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
              <p>{t('no_reservations_for_client')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[350px]">
              <div className="space-y-3">
                {reservations.map((reservation) => {
                  const expired = isExpired(reservation);
                  const isSelected = selectedReservations.has(reservation.id);
                  const selectedQuantity = selectedReservations.get(reservation.id) || reservation.quantity;

                  return (
                    <div
                      key={reservation.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        isSelected 
                          ? 'bg-primary/10 border-primary/50' 
                          : expired 
                            ? 'bg-amber-500/10 border-amber-500/30' 
                            : 'bg-card border-border/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleReservation(reservation.id, reservation.quantity)}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">
                              {reservation.product.name}
                            </span>
                            {expired && (
                              <Badge variant="outline" className="text-amber-600 border-amber-500 text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {t('expired')}
                              </Badge>
                            )}
                          </div>
                          
                          {reservation.product.reference && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {reservation.product.reference}
                            </p>
                          )}
                          
                          <div className="mt-2 text-sm text-muted-foreground">
                            <p>{t('reserved')}: {reservation.quantity} {t('units')}</p>
                            <p>{t('price')}: {reservation.product.price_ht.toFixed(3)} TND</p>
                            {reservation.expiration_date && (
                              <p className="text-xs">
                                {t('expires')}: {format(parseISO(reservation.expiration_date), 'PP', { locale: getDateLocale() })}
                              </p>
                            )}
                          </div>

                          {isSelected && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-sm">{t('quantity_to_invoice')}:</span>
                              <Input
                                type="number"
                                min={1}
                                max={reservation.quantity}
                                value={selectedQuantity}
                                onChange={(e) => handleQuantityChange(
                                  reservation.id, 
                                  parseInt(e.target.value) || 1,
                                  reservation.quantity
                                )}
                                className="w-20 h-8"
                              />
                            </div>
                          )}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('skip')}
          </Button>
          <Button onClick={handleAddSelected} disabled={!hasSelections}>
            {t('add_to_invoice')} {hasSelections && `(${selectedReservations.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
