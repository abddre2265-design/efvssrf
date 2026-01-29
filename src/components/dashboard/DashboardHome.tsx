import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { StatsCards } from './home/StatsCards';
import { SalesChart } from './home/SalesChart';
import { AlertsPanel } from './home/AlertsPanel';
import { QuickActions } from './home/QuickActions';
import { RecentActivity } from './home/RecentActivity';
import { FinancialOverview } from './home/FinancialOverview';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const DashboardHome: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const stats = useDashboardStats();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            {t('dashboard')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('welcomeDashboard')}</p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={stats.refresh}
            disabled={stats.isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${stats.isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </motion.div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} isLoading={stats.isLoading} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          <SalesChart stats={stats} isLoading={stats.isLoading} />
          <FinancialOverview stats={stats} isLoading={stats.isLoading} />
        </div>

        {/* Right column - Alerts & Activity */}
        <div className="space-y-6">
          <AlertsPanel alerts={stats.alerts} isLoading={stats.isLoading} />
          <QuickActions />
          <RecentActivity stats={stats} isLoading={stats.isLoading} />
        </div>
      </div>
    </motion.div>
  );
};

export default DashboardHome;
