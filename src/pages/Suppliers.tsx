import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Truck, ChevronDown, FileSpreadsheet } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { Supplier } from '@/components/suppliers/types';
import { SupplierTable } from '@/components/suppliers/SupplierTable';
import { SupplierViewDialog } from '@/components/suppliers/SupplierViewDialog';
import { SupplierCreateDialog } from '@/components/suppliers/SupplierCreateDialog';
import { SupplierEditDialog } from '@/components/suppliers/SupplierEditDialog';
import { SupplierExcelImportDialog } from '@/components/suppliers/SupplierExcelImportDialog';
import { SupplierAISearch } from '@/components/suppliers/SupplierAISearch';
import { SupplierHistoryDialog } from '@/components/suppliers/SupplierHistoryDialog';

const Suppliers: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiExplanation, setAiExplanation] = useState<string | undefined>();
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [excelImportDialogOpen, setExcelImportDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [duplicateSupplier, setDuplicateSupplier] = useState<Supplier | null>(null);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const supplierData = (data || []) as unknown as Supplier[];
      setSuppliers(supplierData);
      setFilteredSuppliers(supplierData);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleView = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setViewDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setEditDialogOpen(true);
  };

  const handleDuplicate = (supplier: Supplier) => {
    setDuplicateSupplier(supplier);
    setCreateDialogOpen(true);
  };

  const handleHistory = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setHistoryDialogOpen(true);
  };

  const handleCreateDialogClose = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setDuplicateSupplier(null);
    }
  };

  const handleFilteredResults = (results: Supplier[], explanation?: string) => {
    setFilteredSuppliers(results);
    setAiExplanation(explanation);
  };

  const handleClearSearch = () => {
    setFilteredSuppliers(suppliers);
    setAiExplanation(undefined);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 space-y-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('suppliers')}</h1>
          <p className="text-muted-foreground">{t('manage_suppliers')}</p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Truck className="h-4 w-4" />
              {t('add_supplier')}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
            <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
              <Truck className="mr-2 h-4 w-4" />
              {t('manualCreation')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExcelImportDialogOpen(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {t('importFromExcel')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AI Search */}
      <SupplierAISearch
        suppliers={suppliers}
        onFilteredResults={handleFilteredResults}
        onClear={handleClearSearch}
      />

      {/* Supplier Table */}
      <SupplierTable
        suppliers={filteredSuppliers}
        onView={handleView}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onHistory={handleHistory}
        isLoading={isLoading}
      />

      {/* Dialogs */}
      <SupplierCreateDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogClose}
        onCreated={fetchSuppliers}
        duplicateFrom={duplicateSupplier}
      />

      <SupplierViewDialog
        supplier={selectedSupplier}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />

      <SupplierEditDialog
        supplier={selectedSupplier}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdated={fetchSuppliers}
      />

      <SupplierExcelImportDialog
        open={excelImportDialogOpen}
        onOpenChange={setExcelImportDialogOpen}
        onImported={fetchSuppliers}
      />

      <SupplierHistoryDialog
        supplier={selectedSupplier}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      />
    </motion.div>
  );
};

export default Suppliers;
