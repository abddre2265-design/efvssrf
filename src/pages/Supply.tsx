import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from 'react-router-dom';
import { SupplyUploadBlock } from '@/components/purchases/supply';

const Supply: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Extract preloaded PDF data passed via navigate state (from local purchase workflow)
  const preloadedPdf = location.state?.preloadedPdf || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('supply')}</h1>
        <p className="text-muted-foreground mt-1">{t('supply_description')}</p>
      </div>

      {/* Supply Upload Block */}
      <SupplyUploadBlock key={refreshKey} onRefresh={handleRefresh} preloadedPdf={preloadedPdf} />
    </motion.div>
  );
};

export default Supply;
