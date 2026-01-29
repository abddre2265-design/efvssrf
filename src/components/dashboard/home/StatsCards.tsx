import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  Users, 
  Package, 
  Truck, 
  TrendingUp, 
  TrendingDown,
  Wallet,
  CreditCard
} from 'lucide-react';
import { formatCurrency } from '@/components/invoices/types';
import type { DashboardStats } from '@/hooks/useDashboardStats';

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading: boolean;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: 'easeOut' as const,
    },
  }),
};

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, isLoading }) => {
  const { t } = useLanguage();

  const cards = [
    {
      title: t('total_invoices') || 'Factures',
      value: stats.invoicesCount,
      icon: FileText,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
    },
    {
      title: t('clients') || 'Clients',
      value: stats.clientsCount,
      icon: Users,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      iconColor: 'text-green-500',
    },
    {
      title: t('products') || 'Produits',
      value: stats.productsCount,
      icon: Package,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
    },
    {
      title: t('suppliers') || 'Fournisseurs',
      value: stats.suppliersCount,
      icon: Truck,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-500/10',
      iconColor: 'text-orange-500',
    },
    {
      title: t('sales_this_month') || 'Ventes ce mois',
      value: formatCurrency(stats.totalSalesThisMonth, 'TND'),
      subValue: stats.salesGrowth,
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      isGrowth: true,
    },
    {
      title: t('unpaid_amount') || 'Impayés',
      value: formatCurrency(stats.unpaidAmount, 'TND'),
      icon: Wallet,
      color: 'from-red-500 to-rose-500',
      bgColor: 'bg-red-500/10',
      iconColor: 'text-red-500',
    },
    {
      title: t('purchases_this_month') || 'Achats ce mois',
      value: formatCurrency(stats.totalPurchasesThisMonth, 'TND'),
      subValue: stats.purchasesGrowth,
      icon: CreditCard,
      color: 'from-indigo-500 to-violet-500',
      bgColor: 'bg-indigo-500/10',
      iconColor: 'text-indigo-500',
      isGrowth: true,
    },
    {
      title: t('unpaid_purchases') || 'Achats impayés',
      value: formatCurrency(stats.unpaidPurchases, 'TND'),
      icon: TrendingDown,
      color: 'from-amber-500 to-yellow-500',
      bgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            custom={index}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-0 bg-gradient-to-br from-card to-card/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">
                      {card.title}
                    </p>
                    <p className="text-2xl font-bold tracking-tight">
                      {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                    </p>
                    {card.isGrowth && card.subValue !== undefined && (
                      <div className={`flex items-center gap-1 text-xs ${card.subValue >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {card.subValue >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span>{Math.abs(card.subValue).toFixed(1)}%</span>
                        <span className="text-muted-foreground">vs mois dernier</span>
                      </div>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl ${card.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                </div>
                {/* Animated gradient line */}
                <div className={`h-1 mt-3 rounded-full bg-gradient-to-r ${card.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
