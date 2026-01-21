import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  invoicesCount: number;
  clientsCount: number;
  productsCount: number;
  suppliersCount: number;
  unpaidAmount: number;
  pendingPurchases: number;
  isLoading: boolean;
}

export const useDashboardStats = (): DashboardStats => {
  const [stats, setStats] = useState<DashboardStats>({
    invoicesCount: 0,
    clientsCount: 0,
    productsCount: 0,
    suppliersCount: 0,
    unpaidAmount: 0,
    pendingPurchases: 0,
    isLoading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all counts in parallel
        const [
          invoicesResult,
          clientsResult,
          productsResult,
          suppliersResult,
          unpaidInvoicesResult,
          pendingPurchasesResult,
        ] = await Promise.all([
          supabase.from('invoices').select('id', { count: 'exact', head: true }),
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('invoices').select('net_payable, paid_amount').neq('payment_status', 'paid'),
          supabase.from('purchase_documents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);

        // Calculate unpaid amount
        let unpaidAmount = 0;
        if (unpaidInvoicesResult.data) {
          unpaidAmount = unpaidInvoicesResult.data.reduce(
            (sum, inv) => sum + (inv.net_payable - inv.paid_amount),
            0
          );
        }

        setStats({
          invoicesCount: invoicesResult.count || 0,
          clientsCount: clientsResult.count || 0,
          productsCount: productsResult.count || 0,
          suppliersCount: suppliersResult.count || 0,
          unpaidAmount,
          pendingPurchases: pendingPurchasesResult.count || 0,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        setStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchStats();
  }, []);

  return stats;
};
