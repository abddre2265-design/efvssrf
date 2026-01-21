import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { ImportFolder } from '@/components/purchases/types';
import { ImportFolderBlock } from '@/components/purchases/ImportFolderBlock';

const ImportFolders: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [importFolders, setImportFolders] = useState<ImportFolder[]>([]);

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
        .from('import_folders')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setImportFolders((data || []) as ImportFolder[]);
    } catch (error) {
      console.error('Error fetching import folders:', error);
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
          <h1 className="text-3xl font-bold">{t('import_folders')}</h1>
          <p className="text-muted-foreground mt-1">{t('import_folders_description')}</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {/* Import Folders Block */}
      <ImportFolderBlock
        folders={importFolders}
        isLoading={isLoading}
        onRefresh={fetchData}
      />
    </motion.div>
  );
};

export default ImportFolders;
