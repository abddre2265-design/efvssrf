import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Search, Eye, Trash2, Send, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PurchaseOrder } from './types';
import { PurchaseOrderCreateDialog } from './PurchaseOrderCreateDialog';
import { PurchaseOrderViewDialog } from './PurchaseOrderViewDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const PurchaseOrderTable: React.FC = () => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<PurchaseOrder | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: org } = await supabase.from('organizations').select('id').single();
      if (!org) return;

      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select('*, supplier:suppliers(company_name, first_name, last_name)')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as PurchaseOrder[]) || []);
    } catch (err: any) {
      console.error('Error fetching purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleDelete = async () => {
    if (!deleteOrder) return;
    try {
      const { error } = await (supabase as any).from('purchase_orders').delete().eq('id', deleteOrder.id);
      if (error) throw error;
      toast({ title: t('success') || 'Succès', description: t('purchase_order_deleted') || 'Bon de commande supprimé' });
      fetchOrders();
    } catch (err: any) {
      toast({ title: t('error') || 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteOrder(null);
    }
  };

  const handleStatusChange = async (order: PurchaseOrder, newStatus: PurchaseOrder['status']) => {
    try {
      const { error } = await (supabase as any)
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', order.id);
      if (error) throw error;
      toast({ title: t('success') || 'Succès' });
      fetchOrders();
    } catch (err: any) {
      toast({ title: t('error') || 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const getSupplierName = (order: PurchaseOrder) => {
    if (!order.supplier) return '-';
    return order.supplier.company_name || `${order.supplier.first_name || ''} ${order.supplier.last_name || ''}`.trim() || '-';
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: t('draft') || 'Brouillon' },
      sent: { variant: 'default', label: t('sent') || 'Envoyé' },
      confirmed: { variant: 'outline', label: t('confirmed') || 'Confirmé' },
      cancelled: { variant: 'destructive', label: t('cancelled') || 'Annulé' },
    };
    const s = map[status] || map.draft;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    return !q || o.order_number.toLowerCase().includes(q) || getSupplierName(o).toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">{t('purchase_orders') || 'Bons de commande'}</h1>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('create_purchase_order') || 'Créer un bon de commande'}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('search') || 'Rechercher...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('order_number') || 'N° Commande'}</TableHead>
              <TableHead>{t('supplier') || 'Fournisseur'}</TableHead>
              <TableHead>{t('date') || 'Date'}</TableHead>
              <TableHead>{t('total_ttc') || 'Total TTC'}</TableHead>
              <TableHead>{t('status') || 'Statut'}</TableHead>
              <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('loading') || 'Chargement...'}</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('no_data') || 'Aucune donnée'}</TableCell></TableRow>
            ) : filtered.map(order => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.order_number}</TableCell>
                <TableCell>{getSupplierName(order)}</TableCell>
                <TableCell>{new Date(order.order_date).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell>{Number(order.total_ttc).toFixed(3)} {order.currency}</TableCell>
                <TableCell>{statusBadge(order.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewOrder(order)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {order.status === 'draft' && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleStatusChange(order, 'sent')} title={t('mark_sent') || 'Marquer envoyé'}>
                          <Send className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteOrder(order)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    {order.status === 'sent' && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleStatusChange(order, 'confirmed')} title={t('confirm') || 'Confirmer'}>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleStatusChange(order, 'cancelled')} title={t('cancel') || 'Annuler'}>
                          <XCircle className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PurchaseOrderCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchOrders} />
      
      {viewOrder && (
        <PurchaseOrderViewDialog order={viewOrder} open={!!viewOrder} onOpenChange={() => setViewOrder(null)} />
      )}

      <AlertDialog open={!!deleteOrder} onOpenChange={() => setDeleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete') || 'Confirmer la suppression'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_purchase_order_confirm') || 'Voulez-vous vraiment supprimer ce bon de commande ?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Annuler'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t('delete') || 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
