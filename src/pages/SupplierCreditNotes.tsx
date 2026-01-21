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
import { SupplierCreditNote, SupplierCreditNoteType, SupplierCreditNoteStatus } from '@/components/supplier-credit-notes/types';
import { SupplierCreditNoteTable } from '@/components/supplier-credit-notes/SupplierCreditNoteTable';
import { SupplierCreditNoteViewDialog } from '@/components/supplier-credit-notes/SupplierCreditNoteViewDialog';
import { SupplierCreditNoteReturnStockDialog } from '@/components/supplier-credit-notes/SupplierCreditNoteReturnStockDialog';
import { formatCurrency } from '@/components/invoices/types';

interface SupplierCreditNoteWithRelations extends SupplierCreditNote {
  supplier?: { id: string; supplier_type: string; first_name: string | null; last_name: string | null; company_name: string | null; } | null;
  purchase_document?: { id: string; invoice_number: string | null; } | null;
}

const SupplierCreditNotes: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [creditNotes, setCreditNotes] = useState<SupplierCreditNoteWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<SupplierCreditNoteType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SupplierCreditNoteStatus | 'all'>('all');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string | null>(null);
  const [returnStockDialogOpen, setReturnStockDialogOpen] = useState(false);
  const [creditNoteForReturn, setCreditNoteForReturn] = useState<SupplierCreditNoteWithRelations | null>(null);

  const fetchCreditNotes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_credit_notes')
        .select(`*, supplier:suppliers(id, supplier_type, first_name, last_name, company_name), purchase_document:purchase_documents(id, invoice_number)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCreditNotes((data || []) as SupplierCreditNoteWithRelations[]);
    } catch (error) { console.error('Error fetching supplier credit notes:', error); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchCreditNotes(); }, []);

  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter(cn => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const supplierName = cn.supplier?.company_name || `${cn.supplier?.first_name || ''} ${cn.supplier?.last_name || ''}`.trim();
        if (!cn.credit_note_number.toLowerCase().includes(query) && !supplierName.toLowerCase().includes(query) && !cn.purchase_document?.invoice_number?.toLowerCase().includes(query)) return false;
      }
      if (typeFilter !== 'all' && cn.credit_note_type !== typeFilter) return false;
      if (statusFilter !== 'all' && cn.status !== statusFilter) return false;
      return true;
    });
  }, [creditNotes, searchQuery, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const validated = creditNotes.filter(cn => cn.status === 'validated');
    return {
      total: validated.length,
      totalAmount: validated.reduce((sum, cn) => sum + cn.net_amount, 0),
      financialCount: validated.filter(cn => cn.credit_note_type === 'financial').length,
      returnCount: validated.filter(cn => cn.credit_note_type === 'product_return').length,
    };
  }, [creditNotes]);

  const handleView = (cn: SupplierCreditNoteWithRelations) => { setSelectedCreditNoteId(cn.id); setViewDialogOpen(true); };
  const handleReturnStock = (cn: SupplierCreditNoteWithRelations) => { setCreditNoteForReturn(cn); setReturnStockDialogOpen(true); };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">{t('supplier_credit_notes')}</h1><p className="text-muted-foreground">{t('manage_supplier_credit_notes')}</p></div>
        <Button variant="outline" onClick={fetchCreditNotes} className="gap-2"><RefreshCw className="h-4 w-4" />{t('refresh')}</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-full bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">{t('total_credit_notes')}</p><p className="text-2xl font-bold">{stats.total}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-full bg-red-500/10"><TrendingDown className="h-5 w-5 text-red-500" /></div><div><p className="text-sm text-muted-foreground">{t('total_credited')}</p><p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalAmount, 'TND')}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-full bg-blue-500/10"><Banknote className="h-5 w-5 text-blue-500" /></div><div><p className="text-sm text-muted-foreground">{t('financial_credit_notes')}</p><p className="text-xl font-bold">{stats.financialCount}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-full bg-purple-500/10"><RotateCcw className="h-5 w-5 text-purple-500" /></div><div><p className="text-sm text-muted-foreground">{t('product_return_credit_notes')}</p><p className="text-xl font-bold">{stats.returnCount}</p></div></div></CardContent></Card>
      </div>
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder={t('search_supplier_credit_notes')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
        <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as SupplierCreditNoteType | 'all')}><SelectTrigger className="w-[160px]"><SelectValue placeholder={t('type')} /></SelectTrigger><SelectContent><SelectItem value="all">{t('all_types')}</SelectItem><SelectItem value="financial">{t('financial')}</SelectItem><SelectItem value="product_return">{t('product_return')}</SelectItem></SelectContent></Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SupplierCreditNoteStatus | 'all')}><SelectTrigger className="w-[160px]"><SelectValue placeholder={t('status')} /></SelectTrigger><SelectContent><SelectItem value="all">{t('all_statuses')}</SelectItem><SelectItem value="draft">{t('status_draft')}</SelectItem><SelectItem value="validated">{t('status_validated')}</SelectItem><SelectItem value="cancelled">{t('status_cancelled')}</SelectItem></SelectContent></Select>
        </div>
        {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter('all'); }}>{t('clear_filters')}</Button>}
      </div>
      <SupplierCreditNoteTable creditNotes={filteredCreditNotes} isLoading={isLoading} onView={handleView} onReturnStock={handleReturnStock} />
      <SupplierCreditNoteViewDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} creditNoteId={selectedCreditNoteId} onRefresh={fetchCreditNotes} />
      {creditNoteForReturn && <SupplierCreditNoteReturnStockDialog open={returnStockDialogOpen} onOpenChange={setReturnStockDialogOpen} creditNoteId={creditNoteForReturn.id} creditNoteNumber={creditNoteForReturn.credit_note_number} creditBlocked={creditNoteForReturn.credit_blocked} currency={creditNoteForReturn.currency} onSuccess={fetchCreditNotes} />}
    </motion.div>
  );
};

export default SupplierCreditNotes;
