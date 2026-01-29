import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  PieChart, 
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { formatCurrency } from '@/components/invoices/types';
import type { DashboardStats } from '@/hooks/useDashboardStats';

interface FinancialOverviewProps {
  stats: DashboardStats;
  isLoading: boolean;
}

export const FinancialOverview: React.FC<FinancialOverviewProps> = ({ stats, isLoading }) => {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate collection rate
  const totalInvoiced = stats.totalSalesThisMonth + stats.unpaidAmount;
  const collectionRate = totalInvoiced > 0 
    ? (stats.paidAmountThisMonth / totalInvoiced) * 100 
    : 0;

  // Calculate payment rate for purchases
  const totalPurchased = stats.totalPurchasesThisMonth + stats.unpaidPurchases;
  const paymentRate = totalPurchased > 0 
    ? ((totalPurchased - stats.unpaidPurchases) / totalPurchased) * 100 
    : 0;

  // Net position (Ventes - Achats ce mois)
  const netPosition = stats.totalSalesThisMonth - stats.totalPurchasesThisMonth;
  const isPositive = netPosition >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    >
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-card to-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            {t('financial_overview') || 'Aperçu financier'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Net Position */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('net_position') || 'Position nette'}
                </span>
                {isPositive ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{formatCurrency(netPosition, 'TND')}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('sales_minus_purchases') || 'Ventes - Achats ce mois'}
              </p>
            </div>

            {/* Collection Rate */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('collection_rate') || 'Taux d\'encaissement'}
                </span>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-blue-500">
                    {collectionRate.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(stats.paidAmountThisMonth, 'TND')}
                  </span>
                </div>
                <Progress value={collectionRate} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('paid_this_month') || 'Payé ce mois'}
              </p>
            </div>

            {/* Purchase Payment Rate */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('payment_rate') || 'Taux de paiement'}
                </span>
                <TrendingDown className="h-4 w-4 text-purple-500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-purple-500">
                    {paymentRate.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('pending') || 'En attente'}: {formatCurrency(stats.unpaidPurchases, 'TND')}
                  </span>
                </div>
                <Progress value={paymentRate} className="h-2 [&>div]:bg-purple-500" />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('purchases_paid') || 'Achats réglés'}
              </p>
            </div>
          </div>

          {/* Summary Row */}
          <div className="mt-6 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('to_collect') || 'À encaisser'}</p>
              <p className="text-lg font-semibold text-amber-500">{formatCurrency(stats.unpaidAmount, 'TND')}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('to_pay') || 'À payer'}</p>
              <p className="text-lg font-semibold text-red-500">{formatCurrency(stats.unpaidPurchases, 'TND')}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('pending_requests_dashboard') || 'Demandes'}</p>
              <p className="text-lg font-semibold text-blue-500">{stats.pendingInvoiceRequests + stats.pendingQuoteRequests}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('low_stock_products') || 'Stock faible'}</p>
              <p className="text-lg font-semibold text-orange-500">{stats.lowStockProducts}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
