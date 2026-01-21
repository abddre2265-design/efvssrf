import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { UserPlus, FileSpreadsheet, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/components/clients/types';
import { ClientTable } from '@/components/clients/ClientTable';
import { ClientViewDialog } from '@/components/clients/ClientViewDialog';
import { ClientCreateDialog } from '@/components/clients/ClientCreateDialog';
import { ClientEditDialog } from '@/components/clients/ClientEditDialog';
import { ClientExcelImportDialog } from '@/components/clients/ClientExcelImportDialog';
import { ClientAISearch } from '@/components/clients/ClientAISearch';
import { ClientHistoryDialog } from '@/components/clients/ClientHistoryDialog';
import { ClientDepositDialog } from '@/components/payments/ClientDepositDialog';

const Clients: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [duplicateClient, setDuplicateClient] = useState<Client | null>(null);

  const fetchOrganization = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .maybeSingle();
    
    if (data) {
      setOrganizationId(data.id);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const clientsData = (data || []) as unknown as Client[];
      setClients(clientsData);
      setFilteredClients(clientsData);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganization();
    fetchClients();
  }, []);

  const handleView = (client: Client) => {
    setSelectedClient(client);
    setViewDialogOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setEditDialogOpen(true);
  };

  const handleDuplicate = (client: Client) => {
    setDuplicateClient(client);
    setCreateDialogOpen(true);
  };

  const handleHistory = (client: Client) => {
    setSelectedClient(client);
    setHistoryDialogOpen(true);
  };

  const handleAssignPayment = (client: Client) => {
    setSelectedClient(client);
    setDepositDialogOpen(true);
  };

  const handleCreateDialogClose = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setDuplicateClient(null);
    }
  };

  const handleDepositComplete = () => {
    fetchClients();
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
          <h1 className="text-2xl font-bold">{t('clients')}</h1>
          <p className="text-muted-foreground">{t('manage_clients')}</p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              {t('add_client')}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
            <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('manualCreation')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExcelImportOpen(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {t('importFromExcel')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AI Search Bar */}
      <ClientAISearch
        clients={clients}
        onFilteredClients={setFilteredClients}
        organizationId={organizationId}
      />

      {/* Client Table */}
      <ClientTable
        clients={filteredClients}
        onView={handleView}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onHistory={handleHistory}
        onAssignPayment={handleAssignPayment}
        isLoading={isLoading}
      />

      {/* Dialogs */}
      <ClientCreateDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogClose}
        onCreated={fetchClients}
        duplicateFrom={duplicateClient}
      />

      <ClientViewDialog
        client={selectedClient}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />

      <ClientEditDialog
        client={selectedClient}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdated={fetchClients}
      />

      <ClientExcelImportDialog
        open={excelImportOpen}
        onOpenChange={setExcelImportOpen}
        onImported={fetchClients}
      />

      <ClientHistoryDialog
        client={selectedClient}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      />

      <ClientDepositDialog
        open={depositDialogOpen}
        onOpenChange={setDepositDialogOpen}
        onDepositComplete={handleDepositComplete}
        preselectedClient={selectedClient ? {
          id: selectedClient.id,
          client_type: selectedClient.client_type,
          first_name: selectedClient.first_name,
          last_name: selectedClient.last_name,
          company_name: selectedClient.company_name,
          account_balance: selectedClient.account_balance,
        } : null}
      />
    </motion.div>
  );
};

export default Clients;
