import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  // Counts
  invoicesCount: number;
  clientsCount: number;
  productsCount: number;
  suppliersCount: number;
  pendingPurchases: number;
  // Sales amounts
  totalSalesThisMonth: number;
  totalSalesLastMonth: number;
  salesGrowth: number;
  unpaidAmount: number;
  paidAmountThisMonth: number;
  // Purchase amounts
  totalPurchasesThisMonth: number;
  totalPurchasesLastMonth: number;
  purchasesGrowth: number;
  unpaidPurchases: number;
  // Recent activity
  recentInvoicesCount: number;
  recentPaymentsCount: number;
  pendingInvoiceRequests: number;
  pendingQuoteRequests: number;
  // Alerts
  lowStockProducts: number;
  expiringReservations: number;
  overdueInvoices: number;
  // Loading state
  isLoading: boolean;
  // Monthly data for charts
  monthlyData: MonthlyData[];
}

export interface MonthlyData {
  month: string;
  sales: number;
  purchases: number;
  payments: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  message: string;
  count?: number;
  link?: string;
}

export const useDashboardStats = (): DashboardStats & { alerts: Alert[]; refresh: () => void } => {
  const [stats, setStats] = useState<DashboardStats>({
    invoicesCount: 0,
    clientsCount: 0,
    productsCount: 0,
    suppliersCount: 0,
    pendingPurchases: 0,
    totalSalesThisMonth: 0,
    totalSalesLastMonth: 0,
    salesGrowth: 0,
    unpaidAmount: 0,
    paidAmountThisMonth: 0,
    totalPurchasesThisMonth: 0,
    totalPurchasesLastMonth: 0,
    purchasesGrowth: 0,
    unpaidPurchases: 0,
    recentInvoicesCount: 0,
    recentPaymentsCount: 0,
    pendingInvoiceRequests: 0,
    pendingQuoteRequests: 0,
    lowStockProducts: 0,
    expiringReservations: 0,
    overdueInvoices: 0,
    isLoading: true,
    monthlyData: [],
  });

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const fetchStats = useCallback(async () => {
    setStats(prev => ({ ...prev, isLoading: true }));
    
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all data in parallel
      const [
        invoicesResult,
        clientsResult,
        productsResult,
        suppliersResult,
        unpaidInvoicesResult,
        pendingPurchasesResult,
        thisMonthInvoices,
        lastMonthInvoices,
        thisMonthPayments,
        thisMonthPurchases,
        lastMonthPurchases,
        unpaidPurchasesResult,
        recentInvoices,
        recentPayments,
        pendingInvoiceRequests,
        pendingQuoteRequests,
        lowStockProducts,
        expiringReservations,
        overdueInvoices,
      ] = await Promise.all([
        supabase.from('invoices').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('invoices').select('net_payable, paid_amount').neq('payment_status', 'paid'),
        supabase.from('purchase_documents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        // This month's invoices
        supabase.from('invoices').select('net_payable').gte('invoice_date', thisMonthStart),
        // Last month's invoices
        supabase.from('invoices').select('net_payable').gte('invoice_date', lastMonthStart).lt('invoice_date', thisMonthStart),
        // This month's payments
        supabase.from('payments').select('amount').gte('payment_date', thisMonthStart),
        // This month's purchases
        supabase.from('purchase_documents').select('net_payable').gte('invoice_date', thisMonthStart).eq('status', 'validated'),
        // Last month's purchases
        supabase.from('purchase_documents').select('net_payable').gte('invoice_date', lastMonthStart).lt('invoice_date', thisMonthStart).eq('status', 'validated'),
        // Unpaid purchases
        supabase.from('purchase_documents').select('net_payable, paid_amount').neq('payment_status', 'paid').eq('status', 'validated'),
        // Recent invoices (last 7 days)
        supabase.from('invoices').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        // Recent payments (last 7 days)
        supabase.from('payments').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        // Pending invoice requests
        supabase.from('invoice_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        // Pending quote requests
        supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        // Low stock products (stock < 10 and not unlimited)
        supabase.from('products').select('id', { count: 'exact', head: true }).lt('current_stock', 10).eq('unlimited_stock', false).eq('product_type', 'physical').eq('status', 'active'),
        // Expiring reservations (next 3 days)
        supabase.from('product_reservations').select('id', { count: 'exact', head: true }).eq('status', 'active').lte('expiration_date', new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()),
        // Overdue invoices
        supabase.from('invoices').select('id', { count: 'exact', head: true }).neq('payment_status', 'paid').lt('due_date', now.toISOString().split('T')[0]),
      ]);

      // Calculate amounts
      const unpaidAmount = unpaidInvoicesResult.data?.reduce((sum, inv) => sum + (inv.net_payable - inv.paid_amount), 0) || 0;
      const totalSalesThisMonth = thisMonthInvoices.data?.reduce((sum, inv) => sum + inv.net_payable, 0) || 0;
      const totalSalesLastMonth = lastMonthInvoices.data?.reduce((sum, inv) => sum + inv.net_payable, 0) || 0;
      const paidAmountThisMonth = thisMonthPayments.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalPurchasesThisMonth = thisMonthPurchases.data?.reduce((sum, p) => sum + p.net_payable, 0) || 0;
      const totalPurchasesLastMonth = lastMonthPurchases.data?.reduce((sum, p) => sum + p.net_payable, 0) || 0;
      const unpaidPurchases = unpaidPurchasesResult.data?.reduce((sum, p) => sum + (p.net_payable - p.paid_amount), 0) || 0;

      // Calculate growth percentages
      const salesGrowth = totalSalesLastMonth > 0 
        ? ((totalSalesThisMonth - totalSalesLastMonth) / totalSalesLastMonth) * 100 
        : totalSalesThisMonth > 0 ? 100 : 0;
      const purchasesGrowth = totalPurchasesLastMonth > 0 
        ? ((totalPurchasesThisMonth - totalPurchasesLastMonth) / totalPurchasesLastMonth) * 100 
        : totalPurchasesThisMonth > 0 ? 100 : 0;

      // Generate monthly data for charts (last 6 months)
      const monthlyData: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'short' });
        
        monthlyData.push({
          month: monthName,
          sales: 0, // Will be populated later if needed
          purchases: 0,
          payments: 0,
        });
      }

      // Build alerts
      const newAlerts: Alert[] = [];
      
      if ((overdueInvoices.count || 0) > 0) {
        newAlerts.push({
          id: 'overdue',
          type: 'danger',
          title: 'Factures en retard',
          message: `${overdueInvoices.count} facture(s) non payée(s) avec échéance dépassée`,
          count: overdueInvoices.count || 0,
          link: '/dashboard/invoices',
        });
      }

      if ((lowStockProducts.count || 0) > 0) {
        newAlerts.push({
          id: 'lowstock',
          type: 'warning',
          title: 'Stock faible',
          message: `${lowStockProducts.count} produit(s) avec stock inférieur à 10`,
          count: lowStockProducts.count || 0,
          link: '/dashboard/products',
        });
      }

      if ((expiringReservations.count || 0) > 0) {
        newAlerts.push({
          id: 'reservations',
          type: 'warning',
          title: 'Réservations expirantes',
          message: `${expiringReservations.count} réservation(s) expirant dans 3 jours`,
          count: expiringReservations.count || 0,
          link: '/dashboard/products',
        });
      }

      if ((pendingInvoiceRequests.count || 0) > 0) {
        newAlerts.push({
          id: 'invoice_requests',
          type: 'info',
          title: 'Demandes de facture',
          message: `${pendingInvoiceRequests.count} demande(s) en attente de traitement`,
          count: pendingInvoiceRequests.count || 0,
          link: '/dashboard/sales-invoice-requests',
        });
      }

      if ((pendingQuoteRequests.count || 0) > 0) {
        newAlerts.push({
          id: 'quote_requests',
          type: 'info',
          title: 'Demandes de devis',
          message: `${pendingQuoteRequests.count} demande(s) en attente`,
          count: pendingQuoteRequests.count || 0,
          link: '/dashboard/quote-requests',
        });
      }

      if ((pendingPurchasesResult.count || 0) > 0) {
        newAlerts.push({
          id: 'pending_purchases',
          type: 'info',
          title: 'Achats en attente',
          message: `${pendingPurchasesResult.count} document(s) en attente de validation`,
          count: pendingPurchasesResult.count || 0,
          link: '/dashboard/purchase-document-requests',
        });
      }

      setAlerts(newAlerts);

      setStats({
        invoicesCount: invoicesResult.count || 0,
        clientsCount: clientsResult.count || 0,
        productsCount: productsResult.count || 0,
        suppliersCount: suppliersResult.count || 0,
        pendingPurchases: pendingPurchasesResult.count || 0,
        totalSalesThisMonth,
        totalSalesLastMonth,
        salesGrowth,
        unpaidAmount,
        paidAmountThisMonth,
        totalPurchasesThisMonth,
        totalPurchasesLastMonth,
        purchasesGrowth,
        unpaidPurchases,
        recentInvoicesCount: recentInvoices.count || 0,
        recentPaymentsCount: recentPayments.count || 0,
        pendingInvoiceRequests: pendingInvoiceRequests.count || 0,
        pendingQuoteRequests: pendingQuoteRequests.count || 0,
        lowStockProducts: lowStockProducts.count || 0,
        expiringReservations: expiringReservations.count || 0,
        overdueInvoices: overdueInvoices.count || 0,
        isLoading: false,
        monthlyData,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...stats, alerts, refresh: fetchStats };
};
