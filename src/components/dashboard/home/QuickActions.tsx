import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  FileText, 
  Users, 
  Package, 
  Truck,
  Receipt,
  Zap
} from 'lucide-react';

const actions = [
  {
    key: 'create_invoice',
    icon: FileText,
    path: '/dashboard/invoices',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    key: 'add_client',
    icon: Users,
    path: '/dashboard/clients',
    color: 'from-green-500 to-emerald-500',
  },
  {
    key: 'add_product',
    icon: Package,
    path: '/dashboard/products',
    color: 'from-purple-500 to-pink-500',
  },
  {
    key: 'add_payment',
    icon: Receipt,
    path: '/dashboard/payments',
    color: 'from-amber-500 to-orange-500',
  },
];

export const QuickActions: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const getActionLabel = (key: string) => {
    switch (key) {
      case 'create_invoice':
        return t('create_invoice') || 'Créer facture';
      case 'add_client':
        return t('add_client') || 'Ajouter client';
      case 'add_product':
        return t('add_product') || 'Ajouter produit';
      case 'add_payment':
        return t('add_payment') || 'Ajouter paiement';
      default:
        return key;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
    >
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-card to-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {t('quick_actions') || 'Actions rapides'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                >
                  <Button
                    variant="outline"
                    className="w-full h-auto py-3 flex flex-col items-center gap-2 hover:scale-105 transition-all duration-200 group"
                    onClick={() => navigate(action.path)}
                  >
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${action.color} bg-opacity-10 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-center line-clamp-1">
                      {getActionLabel(action.key)}
                    </span>
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
