import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  FileText, 
  CreditCard,
  Clock
} from 'lucide-react';
import type { DashboardStats } from '@/hooks/useDashboardStats';

interface RecentActivityProps {
  stats: DashboardStats;
  isLoading: boolean;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ stats, isLoading }) => {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const activities = [
    {
      icon: FileText,
      label: t('recent_invoices') || 'Factures récentes',
      value: stats.recentInvoicesCount,
      subLabel: t('last_7_days') || '7 derniers jours',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: CreditCard,
      label: t('recent_payments') || 'Paiements récents',
      value: stats.recentPaymentsCount,
      subLabel: t('last_7_days') || '7 derniers jours',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
    >
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-card to-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {t('recent_activity') || 'Activité récente'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const Icon = activity.icon;
              return (
                <motion.div
                  key={activity.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${activity.bgColor}`}>
                    <Icon className={`h-4 w-4 ${activity.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.label}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {activity.subLabel}
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{activity.value}</div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
