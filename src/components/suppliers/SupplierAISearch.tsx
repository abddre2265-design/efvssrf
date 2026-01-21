import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Supplier } from './types';
import { toast } from 'sonner';

interface SupplierAISearchProps {
  suppliers: Supplier[];
  onFilteredResults: (results: Supplier[], aiExplanation?: string) => void;
  onClear: () => void;
}

export const SupplierAISearch: React.FC<SupplierAISearchProps> = ({
  suppliers,
  onFilteredResults,
  onClear,
}) => {
  const { t, isRTL } = useLanguage();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isAIMode, setIsAIMode] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      onClear();
      setAiExplanation(null);
      setSuggestions([]);
      setIsAIMode(false);
      return;
    }

    setIsSearching(true);
    setIsAIMode(true);

    try {
      const { data, error } = await supabase.functions.invoke('supplier-ai-search', {
        body: { query: query.trim() },
      });

      if (error) throw error;

      if (data.supplierIds && data.supplierIds.length > 0) {
        const filtered = suppliers.filter(s => data.supplierIds.includes(s.id));
        onFilteredResults(filtered, data.explanation);
        setAiExplanation(data.explanation || null);
        setSuggestions(data.suggestions || []);
      } else {
        // Fallback to simple search
        const lowerQuery = query.toLowerCase();
        const filtered = suppliers.filter(s => {
          const name = s.company_name || `${s.first_name || ''} ${s.last_name || ''}`.trim();
          return (
            name.toLowerCase().includes(lowerQuery) ||
            s.email?.toLowerCase().includes(lowerQuery) ||
            s.identifier_value?.toLowerCase().includes(lowerQuery) ||
            s.phone?.includes(lowerQuery)
          );
        });
        onFilteredResults(filtered);
        setAiExplanation(data.explanation || t('simple_search_fallback'));
        setSuggestions([]);
      }
    } catch (error) {
      console.error('AI search error:', error);
      
      // Fallback to simple search on error
      const lowerQuery = query.toLowerCase();
      const filtered = suppliers.filter(s => {
        const name = s.company_name || `${s.first_name || ''} ${s.last_name || ''}`.trim();
        return (
          name.toLowerCase().includes(lowerQuery) ||
          s.email?.toLowerCase().includes(lowerQuery) ||
          s.identifier_value?.toLowerCase().includes(lowerQuery) ||
          s.phone?.includes(lowerQuery)
        );
      });
      onFilteredResults(filtered);
      setAiExplanation(t('simple_search_fallback'));
      setSuggestions([]);
      toast.error(t('ai_search_error'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setQuery('');
    setAiExplanation(null);
    setSuggestions([]);
    setIsAIMode(false);
    onClear();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setTimeout(handleSearch, 100);
  };

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('supplier_ai_search_placeholder')}
            className="pl-10 pr-10 bg-background/50 border-primary/20 focus:border-primary"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button onClick={handleSearch} disabled={isSearching} className="gap-2">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {t('search')}
        </Button>
      </div>

      {isAIMode && aiExplanation && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-sm text-muted-foreground">{aiExplanation}</p>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">{t('suggestions')}:</span>
          {suggestions.map((suggestion, index) => (
            <Badge
              key={index}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
