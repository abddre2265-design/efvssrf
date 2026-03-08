import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Search, Loader2, Clock, CheckCircle2, XCircle, FileText, 
  Download, Copy, Receipt, AlertCircle, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { formatCurrency } from '@/components/invoices/types';
import { InvoicePdfTemplate } from '@/components/invoices/InvoicePdfTemplate';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TrackedRequest {
  id: string;
  request_number: string;
  transaction_number: string;
  identifier_value: string;
  identifier_type: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  total_ttc: number;
  status: string;
  payment_status: string;
  purchase_date: string;
  request_date: string;
  generated_invoice_id: string | null;
  pdf_download_count: number;
  store: { name: string } | null;
}

interface PublicRequestTrackerProps {
  organizationId: string;
}

export const PublicRequestTracker: React.FC<PublicRequestTrackerProps> = ({ organizationId }) => {
  const { t, language, isRTL } = useLanguage();
  const [searchMode, setSearchMode] = useState<'transaction' | 'identifier'>('transaction');
  const [searchValue, setSearchValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<TrackedRequest[] | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrintReady, setIsPrintReady] = useState(false);

  const getDateLocale = () => {
    switch (language) { case 'ar': return arSA; case 'en': return enUS; default: return fr; }
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    setIsSearching(true);
    setResults(null);

    try {
      const payload: any = { action: 'search', organizationId };
      if (searchMode === 'transaction') {
        payload.transactionNumber = searchValue.trim();
      } else {
        payload.identifierValue = searchValue.trim();
      }

      const { data, error } = await supabase.functions.invoke('public-request-tracker', {
        body: payload,
      });

      if (error) throw error;
      setResults(data.requests || []);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownloadInvoice = async (request: TrackedRequest) => {
    if (!request.generated_invoice_id) return;
    setIsLoadingPdf(true);

    try {
      // Call edge function to increment download count and get duplicate status
      const { data, error } = await supabase.functions.invoke('public-request-tracker', {
        body: { action: 'get_invoice_data', organizationId, requestId: request.id },
      });

      if (error) throw error;

      setIsDuplicate(data.isDuplicate);
      setSelectedInvoiceId(request.generated_invoice_id);
      setPrintDialogOpen(true);

      // Update local state
      setResults(prev => prev?.map(r => 
        r.id === request.id 
          ? { ...r, pdf_download_count: r.pdf_download_count + 1 } 
          : r
      ) || null);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const printContents = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Facture</title>
            <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
              @media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; } }
            </style>
          </head>
          <body>${printContents}</body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    }
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800"><Clock className="h-3 w-3 mr-1" />{t('request_status_pending')}</Badge>;
      case 'processed':
      case 'converted':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />{t('request_status_processed')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"><XCircle className="h-3 w-3 mr-1" />{t('request_status_rejected')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getClientName = (r: TrackedRequest) => {
    if (r.client_type === 'company' || r.client_type === 'business_local') return r.company_name || '';
    return `${r.first_name || ''} ${r.last_name || ''}`.trim();
  };

  return (
    <div className="space-y-6">
      {/* Search Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('track_requests_tab')}</CardTitle>
              <CardDescription>{t('track_description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={searchMode === 'transaction' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setSearchMode('transaction'); setSearchValue(''); setResults(null); }}
              className="flex-1"
            >
              <Receipt className="h-4 w-4 mr-2" />
              {t('search_by_transaction')}
            </Button>
            <Button
              variant={searchMode === 'identifier' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setSearchMode('identifier'); setSearchValue(''); setResults(null); }}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              {t('search_by_identifier')}
            </Button>
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <Input
              placeholder={searchMode === 'transaction' ? t('enter_transaction_number') : t('enter_identifier_tracking')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching || !searchValue.trim()}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">{isSearching ? t('searching') : t('search_button')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {results !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {results.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">{t('no_requests_found')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('no_requests_found_description')}</p>
                </CardContent>
              </Card>
            ) : (
              results.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      {/* Header row */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">{request.request_number}</span>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>

                      <Separator />

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('transaction_number_label')}</span>
                          <p className="font-medium">{request.transaction_number}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('totalTTC')}</span>
                          <p className="font-bold text-primary">{formatCurrency(request.total_ttc)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('request_date_label')}</span>
                          <p className="font-medium">{format(new Date(request.request_date), 'dd/MM/yyyy', { locale: getDateLocale() })}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('tracking_purchase_date')}</span>
                          <p className="font-medium">{format(new Date(request.purchase_date), 'dd/MM/yyyy', { locale: getDateLocale() })}</p>
                        </div>
                        {request.store && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">{t('store')}</span>
                            <p className="font-medium">{request.store.name}</p>
                          </div>
                        )}
                      </div>

                      {/* Download button for processed requests */}
                      {(request.status === 'processed' || request.status === 'converted') && request.generated_invoice_id && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              {request.pdf_download_count > 0 ? (
                                <><Copy className="h-3 w-3" /> {t('already_downloaded')}</>
                              ) : (
                                <><Download className="h-3 w-3" /> {t('first_download')}</>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleDownloadInvoice(request)}
                              disabled={isLoadingPdf}
                              className="gap-2"
                            >
                              {isLoadingPdf ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : request.pdf_download_count > 0 ? (
                                <Copy className="h-4 w-4" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              {request.pdf_download_count > 0 ? t('download_duplicate') : t('download_invoice')}
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              {isDuplicate ? t('download_duplicate') : t('download_invoice')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-end gap-2 mb-4">
            <Button onClick={handlePrint} disabled={!isPrintReady}>
              <Printer className="h-4 w-4 mr-2" />
              {t('print')}
            </Button>
          </div>

          <div ref={printRef}>
            {selectedInvoiceId && (
              <InvoicePdfTemplate
                invoiceId={selectedInvoiceId}
                isDuplicate={isDuplicate}
                onReady={() => setIsPrintReady(true)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
