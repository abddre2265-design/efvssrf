import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, Loader2, X, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Product } from './types';
import { cn } from '@/lib/utils';

interface ProductAISearchProps {
  products: Product[];
  onFilteredProducts: (products: Product[]) => void;
  organizationId: string | null;
}

interface AISearchResponse {
  filteredProductIds: string[];
  explanation: string;
  suggestions?: string[];
}

export const ProductAISearch: React.FC<ProductAISearchProps> = ({
  products,
  onFilteredProducts,
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
      onFilteredProducts(products);
      setAiResponse(null);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = products.filter(p => {
      return (
        p.name.toLowerCase().includes(query) ||
        p.reference?.toLowerCase().includes(query) ||
        p.ean?.toLowerCase().includes(query) ||
        p.unit?.toLowerCase().includes(query) ||
        p.product_type.toLowerCase().includes(query) ||
        p.status.toLowerCase().includes(query) ||
        String(p.vat_rate).includes(query) ||
        String(p.price_ht).includes(query) ||
        String(p.price_ttc).includes(query) ||
        String(p.purchase_year).includes(query)
      );
    });

    onFilteredProducts(filtered);
  };

  // AI-powered search
  const aiSearch = async () => {
    if (!query.trim() || !organizationId) return;
    
    setIsSearching(true);
    setAiResponse(null);

    try {
      // Prepare product data for AI analysis
      const productData = products.map(p => ({
        id: p.id,
        name: p.name,
        reference: p.reference,
        ean: p.ean,
        type: p.product_type,
        status: p.status,
        vat_rate: p.vat_rate,
        price_ht: p.price_ht,
        price_ttc: p.price_ttc,
        stock: p.unlimited_stock ? 'unlimited' : p.current_stock,
        unit: p.unit,
        year: p.purchase_year,
        max_discount: p.max_discount,
      }));

      // Fetch related data for AI context
      const [invoiceLinesRes, purchaseLinesRes, stockMovementsRes] = await Promise.all([
        supabase
          .from('invoice_lines')
          .select('product_id, quantity, invoice:invoices(invoice_date, status)')
          .in('product_id', products.map(p => p.id))
          .limit(100),
        supabase
          .from('purchase_lines')
          .select('product_id, quantity, purchase_document:purchase_documents(invoice_date, status)')
          .in('product_id', products.map(p => p.id))
          .limit(100),
        supabase
          .from('stock_movements')
          .select('product_id, movement_type, quantity, reason_category, created_at')
          .in('product_id', products.map(p => p.id))
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      // Build context for AI
      const salesByProduct: Record<string, number> = {};
      const purchasesByProduct: Record<string, number> = {};
      const recentActivity: Record<string, string[]> = {};

      invoiceLinesRes.data?.forEach(il => {
        salesByProduct[il.product_id] = (salesByProduct[il.product_id] || 0) + (il.quantity || 0);
      });

      purchaseLinesRes.data?.forEach(pl => {
        purchasesByProduct[pl.product_id] = (purchasesByProduct[pl.product_id] || 0) + (pl.quantity || 0);
      });

      stockMovementsRes.data?.forEach(sm => {
        if (!recentActivity[sm.product_id]) recentActivity[sm.product_id] = [];
        recentActivity[sm.product_id].push(`${sm.movement_type}: ${sm.quantity} (${sm.reason_category})`);
      });

      // Enhanced product data with relationships
      const enhancedProducts = productData.map(p => ({
        ...p,
        total_sold: salesByProduct[p.id] || 0,
        total_purchased: purchasesByProduct[p.id] || 0,
        has_sales: (salesByProduct[p.id] || 0) > 0,
        has_purchases: (purchasesByProduct[p.id] || 0) > 0,
        recent_activity: recentActivity[p.id]?.slice(0, 3) || [],
      }));

      const { data, error } = await supabase.functions.invoke('product-ai-search', {
        body: {
          query,
          products: enhancedProducts,
          language,
        },
      });

      if (error) throw error;

      const response = data as AISearchResponse;
      setAiResponse(response);
      
      // Filter products based on AI response
      const filtered = products.filter(p => response.filteredProductIds.includes(p.id));
      onFilteredProducts(filtered);
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
    onFilteredProducts(products);
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
  }, [query, isAIMode, products]);

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
          placeholder={isAIMode ? t('aiSearchPlaceholder') : t('searchProducts')}
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
