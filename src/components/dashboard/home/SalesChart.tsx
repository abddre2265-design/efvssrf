import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import type { DashboardStats } from '@/hooks/useDashboardStats';

interface SalesChartProps {
  stats: DashboardStats;
  isLoading: boolean;
}

interface ChartData {
  month: string;
  sales: number;
  purchases: number;
}

export const SalesChart: React.FC<SalesChartProps> = ({ isLoading }) => {
  const { t } = useLanguage();
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      setDataLoading(true);
      try {
        const now = new Date();
        const months: ChartData[] = [];

        for (let i = 5; i >= 0; i--) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          const monthName = monthStart.toLocaleDateString('fr-FR', { month: 'short' });

          const [salesResult, purchasesResult] = await Promise.all([
            supabase
              .from('invoices')
              .select('net_payable')
              .gte('invoice_date', monthStart.toISOString())
              .lte('invoice_date', monthEnd.toISOString()),
            supabase
              .from('purchase_documents')
              .select('net_payable')
              .eq('status', 'validated')
              .gte('invoice_date', monthStart.toISOString())
              .lte('invoice_date', monthEnd.toISOString()),
          ]);

          const sales = salesResult.data?.reduce((sum, inv) => sum + inv.net_payable, 0) || 0;
          const purchases = purchasesResult.data?.reduce((sum, p) => sum + p.net_payable, 0) || 0;

          months.push({
            month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            sales: Math.round(sales),
            purchases: Math.round(purchases),
          });
        }

        setChartData(months);
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchChartData();
  }, []);

  if (isLoading || dataLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-card to-card/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('sales_purchases_evolution') || 'Évolution Ventes / Achats'}
          </CardTitle>
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as 'area' | 'bar')}>
            <TabsList className="h-8">
              <TabsTrigger value="area" className="h-6 px-2">
                <TrendingUp className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="bar" className="h-6 px-2">
                <BarChart3 className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="purchasesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={formatValue}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} TND`, '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name={t('sales') || 'Ventes'}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="purchases"
                    name={t('purchases') || 'Achats'}
                    stroke="hsl(270, 70%, 60%)"
                    strokeWidth={2}
                    fill="url(#purchasesGradient)"
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={formatValue}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} TND`, '']}
                  />
                  <Bar 
                    dataKey="sales" 
                    name={t('sales') || 'Ventes'}
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="purchases" 
                    name={t('purchases') || 'Achats'}
                    fill="hsl(270, 70%, 60%)" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">{t('sales') || 'Ventes'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(270, 70%, 60%)' }} />
              <span className="text-sm text-muted-foreground">{t('purchases') || 'Achats'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
