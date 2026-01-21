import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileQuestion, Clock, Check, X, RefreshCw } from 'lucide-react';
import { 
  QuoteRequest, 
  QuoteRequestItem, 
  QuoteRequestMessage,
  PublicQuoteRequestLinkBlock, 
  QuoteRequestTable,
  QuoteRequestViewDialog 
} from '@/components/quote-requests';

const QuoteRequests: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<QuoteRequest | null>(null);
  const [selectedItems, setSelectedItems] = useState<QuoteRequestItem[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<QuoteRequestMessage[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadOrganization();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadRequests();
    }
  }, [organizationId]);

  const loadOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (org) {
        setOrganizationId(org.id);
      }
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  };

  const loadRequests = async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quote_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data as QuoteRequest[] || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = async (request: QuoteRequest) => {
    setSelectedRequest(request);
    
    // Load items and messages
    try {
      const [itemsResult, messagesResult] = await Promise.all([
        supabase
          .from('quote_request_items')
          .select('*')
          .eq('quote_request_id', request.id)
          .order('item_order'),
        supabase
          .from('quote_request_messages')
          .select('*')
          .eq('quote_request_id', request.id)
          .order('created_at'),
      ]);

      setSelectedItems(itemsResult.data as QuoteRequestItem[] || []);
      setSelectedMessages(messagesResult.data as QuoteRequestMessage[] || []);
    } catch (error) {
      console.error('Error loading request details:', error);
    }
    
    setIsViewDialogOpen(true);
  };

  const handleStatusChange = async (request: QuoteRequest, status: 'processing' | 'completed' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('quote_requests')
        .update({ status })
        .eq('id', request.id);

      if (error) throw error;
      
      toast.success('Statut mis à jour');
      loadRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getFilteredRequests = () => {
    switch (activeTab) {
      case 'pending':
        return requests.filter(r => r.status === 'pending');
      case 'processing':
        return requests.filter(r => r.status === 'processing');
      case 'completed':
        return requests.filter(r => r.status === 'completed');
      case 'rejected':
        return requests.filter(r => r.status === 'rejected');
      default:
        return requests;
    }
  };

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    processing: requests.filter(r => r.status === 'processing').length,
    completed: requests.filter(r => r.status === 'completed').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileQuestion className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Demandes de devis</h1>
            <p className="text-muted-foreground">
              Gérez les demandes de devis de vos clients
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En cours</p>
                <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Terminé</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejeté</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <X className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Public Link Block */}
      <PublicQuoteRequestLinkBlock organizationId={organizationId} />

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Demandes reçues</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                Toutes <Badge variant="secondary" className="ml-2">{stats.total}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending">
                En attente <Badge variant="secondary" className="ml-2">{stats.pending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="processing">
                En cours <Badge variant="secondary" className="ml-2">{stats.processing}</Badge>
              </TabsTrigger>
              <TabsTrigger value="completed">
                Terminé <Badge variant="secondary" className="ml-2">{stats.completed}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
              <QuoteRequestTable
                requests={getFilteredRequests()}
                isLoading={isLoading}
                onView={handleView}
                onStatusChange={handleStatusChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <QuoteRequestViewDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        request={selectedRequest}
        items={selectedItems}
        messages={selectedMessages}
      />
    </div>
  );
};

export default QuoteRequests;
