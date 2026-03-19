import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Clock, Check, Send, RefreshCw } from 'lucide-react';
import { Quote, QuoteLine, QuoteTable, QuoteViewDialog } from '@/components/quotes';

const Quotes: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [selectedLines, setSelectedLines] = useState<QuoteLine[]>([]);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadOrganization();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadQuotes();

      const channel = supabase
        .channel('quotes-realtime')
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'quotes',
          filter: `organization_id=eq.${organizationId}`,
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setQuotes(prev => [payload.new as Quote, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setQuotes(prev => prev.map(q => q.id === (payload.new as Quote).id ? payload.new as Quote : q));
          } else if (payload.eventType === 'DELETE') {
            setQuotes(prev => prev.filter(q => q.id !== (payload.old as any).id));
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [organizationId]);

  const loadOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: org } = await supabase.from('organizations').select('id').eq('user_id', user.id).single();
      if (org) setOrganizationId(org.id);
    } catch (e) { console.error(e); }
  };

  const loadQuotes = async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, client:clients(id, client_type, first_name, last_name, company_name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotes((data as any as Quote[]) || []);
    } catch (e) {
      console.error(e);
      toast.error(t('error_loading_quotes'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = async (quote: Quote) => {
    setSelectedQuote(quote);
    try {
      const { data } = await supabase
        .from('quote_lines')
        .select('*, product:products(id, name, reference)')
        .eq('quote_id', quote.id)
        .order('line_order');
      setSelectedLines((data as any as QuoteLine[]) || []);
    } catch (e) { console.error(e); }
    setIsViewOpen(true);
  };

  const handleStatusChange = async (quote: Quote, status: 'sent' | 'accepted' | 'invoiced') => {
    try {
      const { error } = await supabase.from('quotes').update({ status } as any).eq('id', quote.id);
      if (error) throw error;
      toast.success(t('status_updated'));
      loadQuotes();
    } catch (e) {
      console.error(e);
      toast.error(t('error_updating_status'));
    }
  };

  const getFiltered = () => {
    if (activeTab === 'all') return quotes;
    return quotes.filter(q => q.status === activeTab);
  };

  const stats = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    invoiced: quotes.filter(q => q.status === 'invoiced').length,
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
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('quotes')}</h1>
          <p className="text-muted-foreground">{t('quotes_description')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: FileText, color: '' },
          { label: t('status_draft'), value: stats.draft, icon: Clock, color: 'text-muted-foreground' },
          { label: t('status_sent'), value: stats.sent, icon: Send, color: 'text-blue-600' },
          { label: t('status_accepted'), value: stats.accepted, icon: Check, color: 'text-green-600' },
          { label: t('status_invoiced'), value: stats.invoiced, icon: FileText, color: 'text-primary' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
                <s.icon className={`h-8 w-8 ${s.color || 'text-muted-foreground'}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('quotes_list')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">{t('all')} <Badge variant="secondary" className="ml-2">{stats.total}</Badge></TabsTrigger>
              <TabsTrigger value="draft">{t('status_draft')} <Badge variant="secondary" className="ml-2">{stats.draft}</Badge></TabsTrigger>
              <TabsTrigger value="sent">{t('status_sent')} <Badge variant="secondary" className="ml-2">{stats.sent}</Badge></TabsTrigger>
              <TabsTrigger value="accepted">{t('status_accepted')} <Badge variant="secondary" className="ml-2">{stats.accepted}</Badge></TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
              <QuoteTable
                quotes={getFiltered()}
                isLoading={isLoading}
                onView={handleView}
                onStatusChange={handleStatusChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <QuoteViewDialog
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        quote={selectedQuote}
        lines={selectedLines}
      />
    </div>
  );
};

export default Quotes;
