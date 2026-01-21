import React, { useRef, useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X } from 'lucide-react';
import { InvoicePdfTemplate } from './InvoicePdfTemplate';

interface InvoicePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}

export const InvoicePrintDialog: React.FC<InvoicePrintDialogProps> = ({
  open,
  onOpenChange,
  invoiceId,
}) => {
  const { t, isRTL } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const handlePrint = () => {
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
              @media print {
                @page {
                  size: A4;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            ${printContents}
          </body>
        </html>
      `);
      printWindow.document.close();
      
      // Wait for fonts to load
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    
    // For now, we'll use the print dialog as PDF download
    // This can be enhanced with a proper PDF library later
    handlePrint();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[240mm] max-h-[95vh] p-0 overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="p-4 border-b bg-muted/30 flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            {t('print_invoice') || 'Aperçu Facture'}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownloadPdf}
              disabled={!isReady}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handlePrint}
              disabled={!isReady}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              {t('print') || 'Imprimer'}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-auto max-h-[calc(95vh-80px)] p-4 bg-gray-100">
          <div ref={printRef} className="bg-white shadow-lg">
            {invoiceId && (
              <InvoicePdfTemplate 
                invoiceId={invoiceId} 
                onReady={handleReady}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoicePrintDialog;
