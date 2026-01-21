import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { DocumentFamily } from '@/components/purchases/types';
import { DocumentFamilyBlock } from '@/components/purchases/DocumentFamilyBlock';

const DocumentFamilies: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [documentFamilies, setDocumentFamilies] = useState<DocumentFamily[]>([]);

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

      const { data, error } = await supabase
        .from('document_families')
        .select('*')
        .eq('organization_id', org.id)
        .order('name', { ascending: true });

      if (error) throw error;

      setDocumentFamilies((data || []) as DocumentFamily[]);
    } catch (error) {
      console.error('Error fetching document families:', error);
      toast.error(t('error_loading_data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
          <h1 className="text-3xl font-bold">{t('document_families')}</h1>
          <p className="text-muted-foreground mt-1">{t('document_families_description')}</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {/* Document Families Block */}
      <DocumentFamilyBlock
        families={documentFamilies}
        isLoading={isLoading}
        onRefresh={fetchData}
      />
    </motion.div>
  );
};

export default DocumentFamilies;
