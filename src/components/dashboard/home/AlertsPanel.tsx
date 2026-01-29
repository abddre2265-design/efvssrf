import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2,
  Bell,
  ChevronRight
} from 'lucide-react';
import type { Alert } from '@/hooks/useDashboardStats';

interface AlertsPanelProps {
  alerts: Alert[];
  isLoading: boolean;
}

const getAlertIcon = (type: Alert['type']) => {
  switch (type) {
    case 'danger':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-500" />;
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  }
};

const getAlertBgColor = (type: Alert['type']) => {
  switch (type) {
    case 'danger':
      return 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20';
    case 'warning':
      return 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20';
    case 'info':
      return 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20';
    case 'success':
      return 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20';
  }
};

const getBadgeVariant = (type: Alert['type']) => {
  switch (type) {
    case 'danger':
      return 'destructive';
    case 'warning':
      return 'outline';
    case 'info':
      return 'secondary';
    case 'success':
      return 'default';
  }
};

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, isLoading }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    >
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-card to-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {t('notifications') || 'Notifications'}
            {alerts.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
              <p className="text-muted-foreground text-sm">
                {t('no_alerts') || 'Aucune alerte'}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('all_good') || 'Tout est en ordre !'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${getAlertBgColor(alert.type)}`}
                    onClick={() => alert.link && navigate(alert.link)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">{alert.title}</p>
                          {alert.count !== undefined && (
                            <Badge variant={getBadgeVariant(alert.type) as 'default' | 'destructive' | 'outline' | 'secondary'} className="ml-2 shrink-0">
                              {alert.count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {alert.message}
                        </p>
                      </div>
                      {alert.link && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
