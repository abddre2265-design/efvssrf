import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar, Loader2, ShoppingBag, User, X, AlertTriangle } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Product } from '../types';
import { ProductReservation } from './types';

interface ViewReservationsDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const ViewReservationsDialog: React.FC<ViewReservationsDialogProps> = ({
  product,
  open,
  onOpenChange,
  onUpdated,
}) => {
  const { t, language } = useLanguage();
  const [reservations, setReservations] = useState<ProductReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cancelReservation, setCancelReservation] = useState<ProductReservation | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  // Fetch reservations
  useEffect(() => {
    const fetchReservations = async () => {
      if (!open || !product) return;
      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('product_reservations')
          .select(`
            *,
            client:clients(id, first_name, last_name, company_name, client_type)
          `)
          .eq('product_id', product.id)
          .in('status', ['active', 'expired'])
          .order('created_at', { ascending: false });

        if (error) throw error;
        setReservations(data as ProductReservation[]);
      } catch (error) {
        console.error('Fetch reservations error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, [open, product]);

  const getClientName = (client: ProductReservation['client']): string => {
    if (!client) return '-';
    if (client.company_name) return client.company_name;
    return `${client.first_name || ''} ${client.last_name || ''}`.trim();
  };

  const isExpired = (reservation: ProductReservation): boolean => {
    if (!reservation.expiration_date) return false;
    return isPast(parseISO(reservation.expiration_date));
  };

  const handleCancelReservation = async () => {
    if (!cancelReservation || !product) return;

    setIsCancelling(true);
    try {
      // Update reservation status
      const { error: reservationError } = await supabase
        .from('product_reservations')
        .update({ status: 'cancelled' })
        .eq('id', cancelReservation.id);

      if (reservationError) throw reservationError;

      // Update product reserved_stock (only if not unlimited)
      if (!product.unlimited_stock) {
        const newReservedStock = Math.max(0, (product.reserved_stock ?? 0) - cancelReservation.quantity);
        
        const { error: productError } = await supabase
          .from('products')
          .update({ reserved_stock: newReservedStock })
          .eq('id', product.id);

        if (productError) throw productError;
      }

      toast.success(t('reservation_cancelled'));
      setCancelReservation(null);
      
      // Refresh reservations
      const { data } = await supabase
        .from('product_reservations')
        .select(`
          *,
          client:clients(id, first_name, last_name, company_name, client_type)
        `)
        .eq('product_id', product.id)
        .in('status', ['active', 'expired'])
        .order('created_at', { ascending: false });

      setReservations(data as ProductReservation[]);
      onUpdated();
    } catch (error: any) {
      console.error('Cancel reservation error:', error);
      toast.error(error.message || t('genericError'));
    } finally {
      setIsCancelling(false);
    }
  };

  if (!product) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              {t('reserved_quantities')}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50 mb-4">
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-muted-foreground">
                {t('total_reserved')}: {product.reserved_stock ?? 0}
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : reservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ShoppingBag className="h-8 w-8 mb-2 opacity-50" />
                <p>{t('no_reservations')}</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {reservations.map((reservation) => {
                    const expired = isExpired(reservation);
                    return (
                      <div
                        key={reservation.id}
                        className={`p-3 rounded-lg border ${
                          expired 
                            ? 'bg-amber-500/10 border-amber-500/30' 
                            : 'bg-card border-border/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {getClientName(reservation.client)}
                              </span>
                              {expired && (
                                <Badge variant="outline" className="text-amber-600 border-amber-500">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {t('expired')}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="mt-2 text-sm text-muted-foreground space-y-1">
                              <p>{t('quantity')}: <span className="font-medium">{reservation.quantity}</span></p>
                              
                              {reservation.expiration_date ? (
                                <p className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {t('expires')}: {format(parseISO(reservation.expiration_date), 'PPP', { locale: getDateLocale() })}
                                </p>
                              ) : (
                                <p className="text-xs italic">{t('no_expiration')}</p>
                              )}
                              
                              {reservation.notes && (
                                <p className="text-xs italic">{reservation.notes}</p>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setCancelReservation(reservation)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelReservation} onOpenChange={(open) => !open && setCancelReservation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancel_reservation')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cancel_reservation_confirm')}
              <br />
              <span className="font-medium">
                {cancelReservation && getClientName(cancelReservation.client)} - {cancelReservation?.quantity} {t('units')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>{t('no')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelReservation} 
              disabled={isCancelling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('cancelling')}
                </>
              ) : (
                t('yes_cancel')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
