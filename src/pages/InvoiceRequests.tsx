import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  InvoiceRequestLinkBlock, 
  InvoiceRequestTable, 
  InvoiceRequestViewDialog,
  InvoiceRequest 
} from '@/components/invoice-requests';
import { RequestInvoiceCreateDialog } from '@/components/invoice-requests/RequestInvoiceCreateDialog';
import { RequestAIInvoiceDialog } from '@/components/invoice-requests/RequestAIInvoiceDialog';
import { Search, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';

const InvoiceRequests: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [requests, setRequests] = useState<InvoiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<InvoiceRequest | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Processing state
  const [processingRequest, setProcessingRequest] = useState<InvoiceRequest | null>(null);
  const [standardDialogOpen, setStandardDialogOpen] = useState(false);
  const [aiDialogOpen, setAIDialogOpen] = useState(false);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .single();

      if (!org) return;

      const { data, error } = await supabase
        .from('invoice_requests')
        .select(`
          *,
          store:stores(id, name)
        `)
        .eq('organization_id', org.id)
        .order('request_date', { ascending: false });

      if (error) throw error;

      // Transform data to match our types
      const transformedData: InvoiceRequest[] = (data || []).map(item => ({
        ...item,
        client_type: item.client_type as InvoiceRequest['client_type'],
        payment_status: item.payment_status as 'paid' | 'partial' | 'unpaid',
        status: item.status as 'pending' | 'processed' | 'rejected' | 'converted',
        payment_methods: (item.payment_methods as any[]) || [],
        ai_conversation: (item.ai_conversation as any[]) || [],
      }));

      setRequests(transformedData);
      
      // Check if we need to open a specific request
      const openRequestId = searchParams.get('openRequest');
      if (openRequestId) {
        const requestToOpen = transformedData.find(r => r.id === openRequestId);
        if (requestToOpen) {
          setSelectedRequest(requestToOpen);
          setViewDialogOpen(true);
        }
        // Clear the param
        searchParams.delete('openRequest');
        setSearchParams(searchParams);
      }
    } catch (error: any) {
      console.error('Error fetching requests:', error);
      toast.error(t('error_loading_requests'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleView = (request: InvoiceRequest) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
  };

  const handleProcessRequest = (request: InvoiceRequest, method: 'standard' | 'ai') => {
    setProcessingRequest(request);
    if (method === 'standard') {
      setStandardDialogOpen(true);
    } else {
      setAIDialogOpen(true);
    }
  };

  const handleInvoiceCreated = () => {
    fetchRequests();
    setStandardDialogOpen(false);
    setAIDialogOpen(false);
    setProcessingRequest(null);
  };

  const filteredRequests = requests.filter(request => {
    // Filter by tab
    if (activeTab === 'pending' && request.status !== 'pending') return false;
    if (activeTab === 'processed' && !['processed', 'converted'].includes(request.status)) return false;
    if (activeTab === 'rejected' && request.status !== 'rejected') return false;
    
    // Filter by search
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const clientName = request.client_type === 'company' || request.client_type === 'business_local'
      ? request.company_name?.toLowerCase()
      : `${request.first_name} ${request.last_name}`.toLowerCase();
    
    return (
      clientName?.includes(search) ||
      request.identifier_value?.toLowerCase().includes(search) ||
      request.transaction_number?.toLowerCase().includes(search) ||
      request.request_number?.toLowerCase().includes(search)
    );
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const processedCount = requests.filter(r => ['processed', 'converted'].includes(r.status)).length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('invoice_requests')}</h1>
          <p className="text-muted-foreground">{t('invoice_requests_description')}</p>
        </div>
        <Button variant="outline" onClick={fetchRequests} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {/* Public Link Block */}
      <InvoiceRequestLinkBlock />

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search_requests')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('pending')}
            {pendingCount > 0 && (
              <span className="ml-1 bg-yellow-500 text-white text-xs rounded-full px-2 py-0.5">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="processed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {t('processed')}
            {processedCount > 0 && (
              <span className="ml-1 bg-green-500 text-white text-xs rounded-full px-2 py-0.5">
                {processedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            {t('rejected')}
            {rejectedCount > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {rejectedCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <InvoiceRequestTable
            requests={filteredRequests}
            onView={handleView}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="processed" className="mt-4">
          <InvoiceRequestTable
            requests={filteredRequests}
            onView={handleView}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="rejected" className="mt-4">
          <InvoiceRequestTable
            requests={filteredRequests}
            onView={handleView}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

      {/* View Dialog */}
      <InvoiceRequestViewDialog
        request={selectedRequest}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onProcessRequest={handleProcessRequest}
        onRefresh={fetchRequests}
      />

      {/* Standard Invoice Creation Dialog */}
      {processingRequest && (
        <RequestInvoiceCreateDialog
          open={standardDialogOpen}
          onOpenChange={setStandardDialogOpen}
          request={processingRequest}
          onCreated={handleInvoiceCreated}
        />
      )}

      {/* AI Invoice Generation Dialog */}
      {processingRequest && (
        <RequestAIInvoiceDialog
          open={aiDialogOpen}
          onOpenChange={setAIDialogOpen}
          request={processingRequest}
          onCreated={handleInvoiceCreated}
        />
      )}
    </div>
  );
};

export default InvoiceRequests;
