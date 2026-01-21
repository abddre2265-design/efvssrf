import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { PublicUploadLinkBlock } from '@/components/purchases/PublicUploadLinkBlock';
import { PendingPublicUploadsBlock } from '@/components/purchases/PendingPublicUploadsBlock';
import { PurchaseDocumentsBlock } from '@/components/purchases/PurchaseDocumentsBlock';
import { PurchaseDocument } from '@/components/purchases/types';

const ClassificationRequests: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data states
  const [pendingDocuments, setPendingDocuments] = useState<PurchaseDocument[]>([]);
  const [validatedDocuments, setValidatedDocuments] = useState<PurchaseDocument[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .single();

      if (!org) {
        setIsLoading(false);
        return;
      }

      const { data: docs, error } = await supabase
        .from('purchase_documents')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allDocs = (docs || []) as PurchaseDocument[];
      setPendingDocuments(allDocs.filter(d => d.status === 'pending'));
      setValidatedDocuments(allDocs.filter(d => d.status === 'validated'));
    } catch (error) {
      console.error('Error fetching purchases data:', error);
      toast.error(t('error_loading_data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    fetchData();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('classification_requests')}</h1>
          <p className="text-muted-foreground mt-1">{t('classification_requests_description')}</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {/* Public Upload Link Block */}
      <PublicUploadLinkBlock />

      {/* Pending Public Uploads Block */}
      <PendingPublicUploadsBlock key={refreshKey} onRefresh={handleRefresh} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pending_documents')}</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDocuments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('validated_documents')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{validatedDocuments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Documents Block */}
      <PurchaseDocumentsBlock
        pendingDocuments={pendingDocuments}
        validatedDocuments={validatedDocuments}
        isLoading={isLoading}
        onRefresh={handleRefresh}
      />
    </motion.div>
  );
};

export default ClassificationRequests;
