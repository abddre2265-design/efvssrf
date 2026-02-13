import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, Loader2, X, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Client } from './types';
import { cn } from '@/lib/utils';

interface ClientAISearchProps {
  clients: Client[];
  onFilteredClients: (clients: Client[]) => void;
  organizationId: string | null;
}

interface AISearchResponse {
  filteredClientIds: string[];
  explanation: string;
  suggestions?: string[];
}

export const ClientAISearch: React.FC<ClientAISearchProps> = ({
  clients,
  onFilteredClients,
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
      onFilteredClients(clients);
      setAiResponse(null);
      return;
    }

    const q = searchQuery.toLowerCase();
    const filtered = clients.filter(c => {
      const name = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`;
      return (
        name.toLowerCase().includes(q) ||
        c.identifier_value?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q) ||
        c.client_type?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q)
      );
    });

    onFilteredClients(filtered);
  };

  // AI-powered search
  const aiSearch = async () => {
    if (!query.trim() || !organizationId) return;
    
    setIsSearching(true);
    setAiResponse(null);

    try {
      // Prepare client data for AI analysis
      const clientData = clients.map(c => ({
        id: c.id,
        name: c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        type: c.client_type,
        status: c.status,
        identifier_type: c.identifier_type,
        identifier_value: c.identifier_value,
        email: c.email,
        phone: c.phone,
        country: c.country,
        governorate: c.governorate,
        address: c.address,
        account_balance: c.account_balance,
      }));

      // Fetch related data for AI context
      const [invoicesRes, movementsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('client_id, total_ttc, payment_status, status, invoice_date')
          .in('client_id', clients.map(c => c.id))
          .limit(200),
        supabase
          .from('client_account_movements')
          .select('client_id, movement_type, amount, source_type, created_at')
          .in('client_id', clients.map(c => c.id))
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      // Build context for AI
      const invoicesByClient: Record<string, { count: number; total: number; unpaid: number }> = {};
      const movementsByClient: Record<string, { deposits: number; payments: number }> = {};

      invoicesRes.data?.forEach(inv => {
        if (!invoicesByClient[inv.client_id]) {
          invoicesByClient[inv.client_id] = { count: 0, total: 0, unpaid: 0 };
        }
        invoicesByClient[inv.client_id].count++;
        invoicesByClient[inv.client_id].total += inv.total_ttc || 0;
        if (inv.payment_status !== 'paid') {
          invoicesByClient[inv.client_id].unpaid++;
        }
      });

      movementsRes.data?.forEach(mv => {
        if (!movementsByClient[mv.client_id]) {
          movementsByClient[mv.client_id] = { deposits: 0, payments: 0 };
        }
        if (mv.movement_type === 'credit') {
          movementsByClient[mv.client_id].deposits += mv.amount || 0;
        } else {
          movementsByClient[mv.client_id].payments += mv.amount || 0;
        }
      });

      // Enhanced client data with relationships
      const enhancedClients = clientData.map(c => ({
        ...c,
        invoices: invoicesByClient[c.id] || { count: 0, total: 0, unpaid: 0 },
        movements: movementsByClient[c.id] || { deposits: 0, payments: 0 },
        has_invoices: (invoicesByClient[c.id]?.count || 0) > 0,
        has_unpaid_invoices: (invoicesByClient[c.id]?.unpaid || 0) > 0,
        has_deposits: (movementsByClient[c.id]?.deposits || 0) > 0,
      }));

      const { data, error } = await supabase.functions.invoke('client-ai-search', {
        body: {
          query,
          clients: enhancedClients,
          language,
        },
      });

      if (error) throw error;

      const response = data as AISearchResponse;
      setAiResponse(response);
      
      // Filter clients based on AI response
      const filtered = clients.filter(c => response.filteredClientIds.includes(c.id));
      onFilteredClients(filtered);
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
    onFilteredClients(clients);
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
  }, [query, isAIMode, clients]);

  return (
    <div className="space-y-3 flex-1 max-w-xl">
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
          placeholder={isAIMode ? t('client_ai_search_placeholder') : t('search_client')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "pl-10 pr-24 futuristic-input transition-all",
            isAIMode && "border-primary/50 focus:border-primary"
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
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">{aiResponse.explanation}</p>
          </div>
          
          {aiResponse.suggestions && aiResponse.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
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
