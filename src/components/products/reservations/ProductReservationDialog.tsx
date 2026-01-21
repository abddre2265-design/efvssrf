import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Loader2, ShoppingBag, User } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Product } from '../types';

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  client_type: string;
}

interface ProductReservationDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReserved: () => void;
}

export const ProductReservationDialog: React.FC<ProductReservationDialogProps> = ({
  product,
  open,
  onOpenChange,
  onReserved,
}) => {
  const { t, language } = useLanguage();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [clientId, setClientId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  // Calculate available stock
  const availableStock = useMemo(() => {
    if (!product) return 0;
    if (product.unlimited_stock) return Infinity;
    return (product.current_stock ?? 0) - (product.reserved_stock ?? 0);
  }, [product]);

  // Maximum quantity allowed
  const maxQuantity = useMemo(() => {
    if (!product) return 1;
    if (product.unlimited_stock) return Infinity;
    if (product.allow_out_of_stock_sale) return Infinity;
    return Math.max(1, availableStock);
  }, [product, availableStock]);

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      if (!open) return;
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!org) return;

      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, company_name, client_type')
        .eq('organization_id', org.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setClients(data);
      }
      setIsLoading(false);
    };

    fetchClients();
  }, [open]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setClientId('');
      setQuantity(1);
      setExpirationDate(null);
      setNotes('');
    }
  }, [open]);

  const getClientName = (client: Client): string => {
    if (client.company_name) return client.company_name;
    return `${client.first_name || ''} ${client.last_name || ''}`.trim();
  };

  const handleSubmit = async () => {
    if (!product || !clientId) {
      toast.error(t('fill_required_fields'));
      return;
    }

    if (quantity < 1) {
      toast.error(t('quantity_must_be_positive'));
      return;
    }

    if (maxQuantity !== Infinity && quantity > maxQuantity) {
      toast.error(t('quantity_exceeds_available_stock'));
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!org) throw new Error('Organization not found');

      // Create reservation
      const { error: reservationError } = await supabase
        .from('product_reservations')
        .insert({
          organization_id: org.id,
          product_id: product.id,
          client_id: clientId,
          quantity,
          expiration_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : null,
          notes: notes || null,
          status: 'active',
        });

      if (reservationError) throw reservationError;

      // Update product reserved_stock (only if not unlimited)
      if (!product.unlimited_stock) {
        const newReservedStock = (product.reserved_stock ?? 0) + quantity;
        
        const { error: productError } = await supabase
          .from('products')
          .update({ reserved_stock: newReservedStock })
          .eq('id', product.id);

        if (productError) throw productError;
      }

      toast.success(t('reservation_created'));
      onReserved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Reservation error:', error);
      toast.error(error.message || t('genericError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            {t('reserve_product')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              {product.unlimited_stock 
                ? t('unlimited_stock')
                : `${t('available')}: ${availableStock} / ${t('reserved')}: ${product.reserved_stock ?? 0}`
              }
            </p>
          </div>

          {/* Client selection */}
          <div className="space-y-2">
            <Label>{t('client')} *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder={t('select_client')} />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {getClientName(client)}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>{t('quantity')} *</Label>
            <Input
              type="number"
              min={1}
              max={maxQuantity === Infinity ? undefined : maxQuantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
            {maxQuantity !== Infinity && (
              <p className="text-xs text-muted-foreground">
                {t('max')}: {maxQuantity}
              </p>
            )}
          </div>

          {/* Expiration date */}
          <div className="space-y-2">
            <Label>{t('expiration_date')} ({t('optional')})</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !expirationDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate 
                    ? format(expirationDate, 'PPP', { locale: getDateLocale() }) 
                    : t('no_expiration')
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expirationDate || undefined}
                  onSelect={(date) => setExpirationDate(date || null)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  locale={getDateLocale()}
                />
              </PopoverContent>
            </Popover>
            {expirationDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpirationDate(null)}
              >
                {t('clear')}
              </Button>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('optional')}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !clientId}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('reserve')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
