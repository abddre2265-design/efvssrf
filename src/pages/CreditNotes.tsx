import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Search,
  Filter,
  Banknote,
  RotateCcw,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreditNote, CreditNoteType, CreditNoteStatus } from '@/components/credit-notes/types';
import { CreditNoteTable } from '@/components/credit-notes/CreditNoteTable';
import { CreditNoteViewDialog } from '@/components/credit-notes/CreditNoteViewDialog';
import { CreditUnblockDialog } from '@/components/credit-notes/CreditUnblockDialog';
import { CreditRefundDialog } from '@/components/credit-notes/CreditRefundDialog';
import { formatCurrency } from '@/components/invoices/types';

interface CreditNoteWithRelations extends CreditNote {
  client?: {
    id: string;
    client_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  } | null;
  invoice?: {
    id: string;
    invoice_number: string;
  } | null;
}

const CreditNotes: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [creditNotes, setCreditNotes] = useState<CreditNoteWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CreditNoteType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<CreditNoteStatus | 'all'>('all');
  
  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string | null>(null);
  
  // Unblock dialog
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [creditNoteForUnblock, setCreditNoteForUnblock] = useState<CreditNoteWithRelations | null>(null);

  // Refund dialog
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [creditNoteForRefund, setCreditNoteForRefund] = useState<CreditNoteWithRelations | null>(null);

  const fetchCreditNotes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          client:clients(id, client_type, first_name, last_name, company_name),
          invoice:invoices(id, invoice_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCreditNotes((data || []) as CreditNoteWithRelations[]);
    } catch (error) {
      console.error('Error fetching credit notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  // Filter credit notes
  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter(cn => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const clientName = cn.client?.company_name || 
          `${cn.client?.first_name || ''} ${cn.client?.last_name || ''}`.trim();
        const matchesSearch = 
          cn.credit_note_number.toLowerCase().includes(query) ||
          clientName.toLowerCase().includes(query) ||
          cn.invoice?.invoice_number.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Type filter
      if (typeFilter !== 'all' && cn.credit_note_type !== typeFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && cn.status !== statusFilter) return false;
      
      return true;
    });
  }, [creditNotes, searchQuery, typeFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const validated = creditNotes.filter(cn => cn.status === 'validated');
    const totalAmount = validated.reduce((sum, cn) => sum + cn.net_amount, 0);
    const financialCount = validated.filter(cn => cn.credit_note_type === 'financial').length;
    const returnCount = validated.filter(cn => cn.credit_note_type === 'product_return').length;
    const financialAmount = validated
      .filter(cn => cn.credit_note_type === 'financial')
      .reduce((sum, cn) => sum + cn.net_amount, 0);
    const returnAmount = validated
      .filter(cn => cn.credit_note_type === 'product_return')
      .reduce((sum, cn) => sum + cn.net_amount, 0);

    return {
      total: validated.length,
      totalAmount,
      financialCount,
      returnCount,
      financialAmount,
      returnAmount,
    };
  }, [creditNotes]);

  const handleView = (creditNote: CreditNoteWithRelations) => {
    setSelectedCreditNoteId(creditNote.id);
    setViewDialogOpen(true);
  };

  const handleUnblock = (creditNote: CreditNoteWithRelations) => {
    setCreditNoteForUnblock(creditNote);
    setUnblockDialogOpen(true);
  };

  const handleRefund = (creditNote: CreditNoteWithRelations) => {
    setCreditNoteForRefund(creditNote);
    setRefundDialogOpen(true);
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
          <h1 className="text-2xl font-bold">{t('credit_notes')}</h1>
          <p className="text-muted-foreground">{t('manage_credit_notes')}</p>
        </div>
        
        <Button variant="outline" onClick={fetchCreditNotes} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('refresh')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('total_credit_notes')}</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('total_credited')}</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalAmount, 'TND')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Banknote className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('financial_credit_notes')}</p>
                <p className="text-xl font-bold">{stats.financialCount}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(stats.financialAmount, 'TND')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-500/10">
                <RotateCcw className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('product_return_credit_notes')}</p>
                <p className="text-xl font-bold">{stats.returnCount}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(stats.returnAmount, 'TND')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search_credit_notes')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CreditNoteType | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_types')}</SelectItem>
              <SelectItem value="financial">{t('financial')}</SelectItem>
              <SelectItem value="product_return">{t('product_return')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CreditNoteStatus | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_statuses')}</SelectItem>
              <SelectItem value="draft">{t('status_draft')}</SelectItem>
              <SelectItem value="validated">{t('status_validated')}</SelectItem>
              <SelectItem value="cancelled">{t('status_cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setTypeFilter('all');
              setStatusFilter('all');
            }}
          >
            {t('clear_filters')}
          </Button>
        )}
      </div>

      {/* Results count */}
      {filteredCreditNotes.length !== creditNotes.length && (
        <p className="text-sm text-muted-foreground">
          {filteredCreditNotes.length} {t('filtered')} / {creditNotes.length} {t('total')}
        </p>
      )}

      {/* Credit Notes Table */}
      <CreditNoteTable
        creditNotes={filteredCreditNotes}
        isLoading={isLoading}
        onView={handleView}
        onUnblock={handleUnblock}
        onRefund={handleRefund}
      />

      {/* View Dialog */}
      <CreditNoteViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        creditNoteId={selectedCreditNoteId}
        onRefresh={fetchCreditNotes}
      />

      {/* Unblock Dialog */}
      {creditNoteForUnblock && (
        <CreditUnblockDialog
          open={unblockDialogOpen}
          onOpenChange={setUnblockDialogOpen}
          creditNoteId={creditNoteForUnblock.id}
          creditNoteNumber={creditNoteForUnblock.credit_note_number}
          creditBlocked={creditNoteForUnblock.credit_blocked}
          currency={creditNoteForUnblock.currency}
          clientId={creditNoteForUnblock.client_id}
          organizationId={creditNoteForUnblock.organization_id}
          onSuccess={fetchCreditNotes}
        />
      )}

      {/* Refund Dialog */}
      {creditNoteForRefund && (
        <CreditRefundDialog
          open={refundDialogOpen}
          onOpenChange={setRefundDialogOpen}
          creditNoteId={creditNoteForRefund.id}
          creditNoteNumber={creditNoteForRefund.credit_note_number}
          creditAvailable={creditNoteForRefund.credit_available}
          invoiceId={creditNoteForRefund.invoice_id}
          clientId={creditNoteForRefund.client_id}
          organizationId={creditNoteForRefund.organization_id}
          currency={creditNoteForRefund.currency}
          onSuccess={fetchCreditNotes}
        />
      )}
    </motion.div>
  );
};

export default CreditNotes;
