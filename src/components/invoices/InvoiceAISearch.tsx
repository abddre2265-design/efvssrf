import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, Loader2, X, Send, TrendingUp, FileText, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, formatCurrency } from './types';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO } from 'date-fns';

interface InvoiceAISearchProps {
  invoices: Invoice[];
  onFilteredInvoices: (invoices: Invoice[]) => void;
  organizationId: string | null;
}

interface AISearchResponse {
  filteredInvoiceIds: string[];
  explanation: string;
  suggestions?: string[];
  stats?: {
    total_amount: number;
    unpaid_amount: number;
    count: number;
  };
}

export const InvoiceAISearch: React.FC<InvoiceAISearchProps> = ({
  invoices,
  onFilteredInvoices,
  organizationId,
}) => {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiResponse, setAiResponse] = useState<AISearchResponse | null>(null);
  const [isAIMode, setIsAIMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Simple text search fallback
  const simpleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      onFilteredInvoices(invoices);
      setAiResponse(null);
      return;
    }

    const q = searchQuery.toLowerCase();
    const filtered = invoices.filter(inv => {
      const clientName = inv.client?.company_name || 
        `${inv.client?.first_name || ''} ${inv.client?.last_name || ''}`;
      return (
        inv.invoice_number?.toLowerCase().includes(q) ||
        clientName.toLowerCase().includes(q) ||
        inv.status?.toLowerCase().includes(q) ||
        inv.payment_status?.toLowerCase().includes(q) ||
        inv.currency?.toLowerCase().includes(q) ||
        inv.client_type?.toLowerCase().includes(q)
      );
    });

    onFilteredInvoices(filtered);
  };

  // AI-powered search
  const aiSearch = async () => {
    if (!query.trim() || !organizationId) return;
    
    setIsSearching(true);
    setAiResponse(null);

    try {
      // Fetch invoice lines and payments for context
      const invoiceIds = invoices.map(inv => inv.id);
      
      const [linesRes, paymentsRes, creditNotesRes] = await Promise.all([
        supabase
          .from('invoice_lines')
          .select('invoice_id, product:products(name)')
          .in('invoice_id', invoiceIds),
        supabase
          .from('payments')
          .select('invoice_id, amount, net_amount')
          .in('invoice_id', invoiceIds),
        supabase
          .from('credit_notes')
          .select('invoice_id, net_amount, status')
          .in('invoice_id', invoiceIds),
      ]);

      // Build lines map
      const linesByInvoice: Record<string, string[]> = {};
      linesRes.data?.forEach((line: any) => {
        if (!linesByInvoice[line.invoice_id]) {
          linesByInvoice[line.invoice_id] = [];
        }
        if (line.product?.name) {
          linesByInvoice[line.invoice_id].push(line.product.name);
        }
      });

      // Build payments map
      const paymentsByInvoice: Record<string, { count: number; total: number }> = {};
      paymentsRes.data?.forEach((p: any) => {
        if (!paymentsByInvoice[p.invoice_id]) {
          paymentsByInvoice[p.invoice_id] = { count: 0, total: 0 };
        }
        paymentsByInvoice[p.invoice_id].count++;
        paymentsByInvoice[p.invoice_id].total += p.net_amount || p.amount || 0;
      });

      // Build credit notes map
      const creditNotesByInvoice: Record<string, { count: number; total: number }> = {};
      creditNotesRes.data?.forEach((cn: any) => {
        if (cn.status !== 'cancelled') {
          if (!creditNotesByInvoice[cn.invoice_id]) {
            creditNotesByInvoice[cn.invoice_id] = { count: 0, total: 0 };
          }
          creditNotesByInvoice[cn.invoice_id].count++;
          creditNotesByInvoice[cn.invoice_id].total += cn.net_amount || 0;
        }
      });

      // Prepare invoice data for AI
      const today = new Date();
      const invoiceData = invoices.map(inv => {
        const clientName = inv.client?.company_name || 
          `${inv.client?.first_name || ''} ${inv.client?.last_name || ''}`.trim();
        
        const dueDate = inv.due_date ? parseISO(inv.due_date) : null;
        const daysOverdue = dueDate ? differenceInDays(today, dueDate) : 0;
        
        const payments = paymentsByInvoice[inv.id] || { count: 0, total: 0 };
        const creditNotes = creditNotesByInvoice[inv.id] || { count: 0, total: 0 };
        const lines = linesByInvoice[inv.id] || [];

        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          client_name: clientName,
          client_type: inv.client_type,
          client_identifier: '',
          status: inv.status,
          payment_status: inv.payment_status,
          currency: inv.currency,
          subtotal_ht: inv.subtotal_ht,
          total_vat: inv.total_vat,
          total_discount: inv.total_discount,
          total_ttc: inv.total_ttc,
          stamp_duty_amount: inv.stamp_duty_amount,
          net_payable: inv.net_payable,
          paid_amount: inv.paid_amount,
          remaining_amount: inv.net_payable - inv.paid_amount,
          withholding_applied: inv.withholding_applied,
          withholding_amount: inv.withholding_amount,
          lines_count: lines.length,
          lines_products: [...new Set(lines)],
          payments_count: payments.count,
          total_payments: payments.total,
          credit_notes_count: creditNotes.count,
          total_credited: creditNotes.total,
          days_overdue: daysOverdue,
          is_overdue: daysOverdue > 0 && inv.payment_status !== 'paid',
        };
      });

      const { data, error } = await supabase.functions.invoke('invoice-ai-search', {
        body: {
          query,
          invoices: invoiceData,
          language,
        },
      });

      if (error) throw error;

      const response = data as AISearchResponse;
      setAiResponse(response);
      
      // Filter invoices based on AI response
      const filtered = invoices.filter(inv => response.filteredInvoiceIds.includes(inv.id));
      onFilteredInvoices(filtered);
    } catch (error) {
      console.error('AI search error:', error);
      // Fallback to simple search
      simpleSearch(query);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isAIMode) {
        aiSearch();
      } else {
        simpleSearch(query);
      }
    }
  };

  const handleClear = () => {
    setQuery('');
    setAiResponse(null);
    onFilteredInvoices(invoices);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setIsAIMode(true);
    setTimeout(() => aiSearch(), 100);
  };

  // Update simple search when query changes in non-AI mode
  useEffect(() => {
    if (!isAIMode && query !== undefined) {
      simpleSearch(query);
    }
  }, [query, isAIMode, invoices]);

  return (
    <div className="space-y-3 flex-1 max-w-2xl">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isAIMode ? (
            <Sparkles className="w-4 h-4 text-primary" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        
        <Input
          ref={inputRef}
          placeholder={isAIMode 
            ? (language === 'fr' 
              ? "Ex: factures impayées, échues, client X, avec avoirs..." 
              : language === 'ar'
              ? "مثال: فواتير غير مدفوعة، متأخرة، العميل..."
              : "Ex: unpaid invoices, overdue, client X, with credit notes...")
            : t('search_invoice')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "pl-10 pr-28 transition-all",
            isAIMode && "border-primary/50 focus:border-primary ring-primary/20"
          )}
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          
          <Button
            variant={isAIMode ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 gap-1 text-xs",
              isAIMode && "bg-primary"
            )}
            onClick={() => {
              setIsAIMode(!isAIMode);
              if (!isAIMode && query) {
                aiSearch();
              }
            }}
          >
            <Sparkles className="h-3 w-3" />
            AI
          </Button>
          
          {isAIMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={aiSearch}
              disabled={isSearching || !query.trim()}
            >
              {isSearching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* AI Response */}
      {aiResponse && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">{aiResponse.explanation}</p>
          </div>
          
          {/* Stats */}
          {aiResponse.stats && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-primary/10">
              <div className="flex items-center gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{aiResponse.stats.count}</span>
                <span className="text-muted-foreground">{t('invoices')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <DollarSign className="h-3.5 w-3.5 text-green-600" />
                <span className="font-medium">{formatCurrency(aiResponse.stats.total_amount, 'TND')}</span>
                <span className="text-muted-foreground">{t('total')}</span>
              </div>
              {aiResponse.stats.unpaid_amount > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <TrendingUp className="h-3.5 w-3.5 text-orange-600" />
                  <span className="font-medium text-orange-600">
                    {formatCurrency(aiResponse.stats.unpaid_amount, 'TND')}
                  </span>
                  <span className="text-muted-foreground">{t('remaining')}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Suggestions */}
          {aiResponse.suggestions && aiResponse.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {aiResponse.suggestions.map((suggestion, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/20 transition-colors text-xs"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
