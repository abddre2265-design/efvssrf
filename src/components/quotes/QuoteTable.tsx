import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Quote } from './types';
import { formatCurrency } from '@/components/invoices/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, MoreHorizontal, Send, Check, FileText, Search, User, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';

interface QuoteTableProps {
  quotes: Quote[];
  isLoading: boolean;
  onView: (quote: Quote) => void;
  onStatusChange: (quote: Quote, status: 'sent' | 'accepted' | 'invoiced') => void;
}

export const QuoteTable: React.FC<QuoteTableProps> = ({ quotes, isLoading, onView, onStatusChange }) => {
  const { t, language, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const getLocale = () => {
    switch (language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">{t('status_draft')}</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">{t('status_sent')}</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">{t('status_accepted')}</Badge>;
      case 'invoiced':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{t('status_invoiced')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getClientName = (quote: Quote) => {
    if (!quote.client) return t('unknown_client');
    if (quote.client.company_name) return quote.client.company_name;
    return `${quote.client.first_name || ''} ${quote.client.last_name || ''}`.trim() || t('unknown_client');
  };

  const filtered = quotes.filter(q => {
    const s = searchQuery.toLowerCase();
    return q.quote_number.toLowerCase().includes(s) || getClientName(q).toLowerCase().includes(s);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('quote_number')}</TableHead>
              <TableHead>{t('date')}</TableHead>
              <TableHead>{t('client')}</TableHead>
              <TableHead className="text-right">{t('total_ttc')}</TableHead>
              <TableHead className="text-right">{t('net_payable')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('no_quotes_found')}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-mono text-sm">{quote.quote_number}</TableCell>
                  <TableCell>{format(new Date(quote.quote_date), 'dd/MM/yyyy', { locale: getLocale() })}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {quote.client?.company_name ? <Building2 className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                      {getClientName(quote)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(quote.total_ttc, quote.currency)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatCurrency(quote.net_payable, quote.currency)}</TableCell>
                  <TableCell>{getStatusBadge(quote.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(quote)}>
                          <Eye className="mr-2 h-4 w-4" />{t('view_details')}
                        </DropdownMenuItem>
                        {quote.status === 'draft' && (
                          <DropdownMenuItem onClick={() => onStatusChange(quote, 'sent')}>
                            <Send className="mr-2 h-4 w-4" />{t('mark_sent')}
                          </DropdownMenuItem>
                        )}
                        {quote.status === 'sent' && (
                          <DropdownMenuItem onClick={() => onStatusChange(quote, 'accepted')}>
                            <Check className="mr-2 h-4 w-4" />{t('mark_accepted')}
                          </DropdownMenuItem>
                        )}
                        {quote.status === 'accepted' && (
                          <DropdownMenuItem onClick={() => onStatusChange(quote, 'invoiced')}>
                            <FileText className="mr-2 h-4 w-4" />{t('convert_to_invoice')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
