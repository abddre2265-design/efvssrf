import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, FileX2, Eye, Settings2, Sparkles, Check, X, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PdfTemplatePreview } from '@/components/pdf-settings/PdfTemplatePreview';
import { PdfComponentsList } from '@/components/pdf-settings/PdfComponentsList';
import { PdfAIAgent } from '@/components/pdf-settings/PdfAIAgent';

export type DocumentType = 'invoice' | 'credit-note';

export interface PdfComponent {
  id: string;
  labelKey: string;
  enabled: boolean;
  category: 'header' | 'content' | 'footer';
}

// Default components for Invoice PDF
const defaultInvoiceComponents: PdfComponent[] = [
  // Header
  { id: 'logo', labelKey: 'pdf_component_logo', enabled: true, category: 'header' },
  { id: 'company_info', labelKey: 'pdf_component_company_info', enabled: true, category: 'header' },
  { id: 'company_name', labelKey: 'pdf_component_company_name', enabled: true, category: 'header' },
  { id: 'company_address', labelKey: 'pdf_component_company_address', enabled: true, category: 'header' },
  { id: 'company_phone', labelKey: 'pdf_component_company_phone', enabled: true, category: 'header' },
  { id: 'company_email', labelKey: 'pdf_component_company_email', enabled: true, category: 'header' },
  { id: 'company_identifier', labelKey: 'pdf_component_company_identifier', enabled: true, category: 'header' },
  { id: 'invoice_title', labelKey: 'pdf_component_invoice_title', enabled: true, category: 'header' },
  { id: 'invoice_number', labelKey: 'pdf_component_invoice_number', enabled: true, category: 'header' },
  { id: 'invoice_date', labelKey: 'pdf_component_invoice_date', enabled: true, category: 'header' },
  { id: 'due_date', labelKey: 'pdf_component_due_date', enabled: true, category: 'header' },
  { id: 'status_badge', labelKey: 'pdf_component_status_badge', enabled: true, category: 'header' },
  // Content
  { id: 'client_info', labelKey: 'pdf_component_client_info', enabled: true, category: 'content' },
  { id: 'client_name', labelKey: 'pdf_component_client_name', enabled: true, category: 'content' },
  { id: 'client_address', labelKey: 'pdf_component_client_address', enabled: true, category: 'content' },
  { id: 'client_identifier', labelKey: 'pdf_component_client_identifier', enabled: true, category: 'content' },
  { id: 'client_phone', labelKey: 'pdf_component_client_phone', enabled: false, category: 'content' },
  { id: 'client_email', labelKey: 'pdf_component_client_email', enabled: false, category: 'content' },
  { id: 'payment_status', labelKey: 'pdf_component_payment_status', enabled: true, category: 'content' },
  { id: 'products_table', labelKey: 'pdf_component_products_table', enabled: true, category: 'content' },
  { id: 'product_reference', labelKey: 'pdf_component_product_reference', enabled: true, category: 'content' },
  { id: 'product_description', labelKey: 'pdf_component_product_description', enabled: true, category: 'content' },
  { id: 'vat_column', labelKey: 'pdf_component_vat_column', enabled: true, category: 'content' },
  { id: 'discount_column', labelKey: 'pdf_component_discount_column', enabled: true, category: 'content' },
  { id: 'totals_box', labelKey: 'pdf_component_totals_box', enabled: true, category: 'content' },
  { id: 'stamp_duty', labelKey: 'pdf_component_stamp_duty', enabled: true, category: 'content' },
  { id: 'withholding_tax', labelKey: 'pdf_component_withholding_tax', enabled: true, category: 'content' },
  // Footer
  { id: 'decorative_corners', labelKey: 'pdf_component_decorative_corners', enabled: true, category: 'footer' },
  { id: 'bank_info', labelKey: 'pdf_component_bank_info', enabled: true, category: 'footer' },
  { id: 'signature_area', labelKey: 'pdf_component_signature_area', enabled: true, category: 'footer' },
  { id: 'legal_mentions', labelKey: 'pdf_component_legal_mentions', enabled: false, category: 'footer' },
  { id: 'qr_code', labelKey: 'pdf_component_qr_code', enabled: false, category: 'footer' },
  { id: 'stamp', labelKey: 'pdf_component_stamp', enabled: false, category: 'footer' },
];

// Default components for Credit Note PDF
const defaultCreditNoteComponents: PdfComponent[] = [
  // Header
  { id: 'logo', labelKey: 'pdf_component_logo', enabled: true, category: 'header' },
  { id: 'company_info', labelKey: 'pdf_component_company_info', enabled: true, category: 'header' },
  { id: 'company_name', labelKey: 'pdf_component_company_name', enabled: true, category: 'header' },
  { id: 'company_address', labelKey: 'pdf_component_company_address', enabled: true, category: 'header' },
  { id: 'company_phone', labelKey: 'pdf_component_company_phone', enabled: true, category: 'header' },
  { id: 'company_email', labelKey: 'pdf_component_company_email', enabled: true, category: 'header' },
  { id: 'company_identifier', labelKey: 'pdf_component_company_identifier', enabled: true, category: 'header' },
  { id: 'credit_note_title', labelKey: 'pdf_component_credit_note_title', enabled: true, category: 'header' },
  { id: 'credit_note_number', labelKey: 'pdf_component_credit_note_number', enabled: true, category: 'header' },
  { id: 'credit_note_date', labelKey: 'pdf_component_credit_note_date', enabled: true, category: 'header' },
  { id: 'credit_note_type', labelKey: 'pdf_component_credit_note_type', enabled: true, category: 'header' },
  { id: 'status_badge', labelKey: 'pdf_component_status_badge', enabled: true, category: 'header' },
  // Content
  { id: 'client_info', labelKey: 'pdf_component_client_info', enabled: true, category: 'content' },
  { id: 'client_name', labelKey: 'pdf_component_client_name', enabled: true, category: 'content' },
  { id: 'client_address', labelKey: 'pdf_component_client_address', enabled: true, category: 'content' },
  { id: 'client_identifier', labelKey: 'pdf_component_client_identifier', enabled: true, category: 'content' },
  { id: 'client_phone', labelKey: 'pdf_component_client_phone', enabled: false, category: 'content' },
  { id: 'client_email', labelKey: 'pdf_component_client_email', enabled: false, category: 'content' },
  { id: 'invoice_reference', labelKey: 'pdf_component_invoice_reference', enabled: true, category: 'content' },
  { id: 'products_table', labelKey: 'pdf_component_products_table', enabled: true, category: 'content' },
  { id: 'return_reason', labelKey: 'pdf_component_return_reason', enabled: true, category: 'content' },
  { id: 'totals_box', labelKey: 'pdf_component_totals_box', enabled: true, category: 'content' },
  { id: 'credit_status_section', labelKey: 'pdf_component_credit_status_section', enabled: true, category: 'content' },
  // Footer
  { id: 'decorative_corners', labelKey: 'pdf_component_decorative_corners', enabled: true, category: 'footer' },
  { id: 'bank_info', labelKey: 'pdf_component_bank_info', enabled: true, category: 'footer' },
  { id: 'signature_area', labelKey: 'pdf_component_signature_area', enabled: true, category: 'footer' },
  { id: 'legal_mentions', labelKey: 'pdf_component_legal_mentions', enabled: false, category: 'footer' },
  { id: 'qr_code', labelKey: 'pdf_component_qr_code', enabled: false, category: 'footer' },
  { id: 'stamp', labelKey: 'pdf_component_stamp', enabled: false, category: 'footer' },
];

const PdfSettings: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<DocumentType>('invoice');
  const [invoiceComponents, setInvoiceComponents] = useState<PdfComponent[]>(defaultInvoiceComponents);
  const [creditNoteComponents, setCreditNoteComponents] = useState<PdfComponent[]>(defaultCreditNoteComponents);
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const currentComponents = activeTab === 'invoice' ? invoiceComponents : creditNoteComponents;
  const setCurrentComponents = activeTab === 'invoice' ? setInvoiceComponents : setCreditNoteComponents;

  const handleToggleComponent = (componentId: string, enabled: boolean) => {
    setCurrentComponents(prev => 
      prev.map(comp => comp.id === componentId ? { ...comp, enabled } : comp)
    );
    // Refresh preview
    setPreviewKey(prev => prev + 1);
  };

  const handleResetToDefault = () => {
    if (activeTab === 'invoice') {
      setInvoiceComponents(defaultInvoiceComponents);
    } else {
      setCreditNoteComponents(defaultCreditNoteComponents);
    }
    setPreviewKey(prev => prev + 1);
  };

  const enabledCount = currentComponents.filter(c => c.enabled).length;
  const totalCount = currentComponents.length;

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : ''}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-primary" />
            {t('pdf_settings_title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('pdf_settings_description')}</p>
        </div>
        <Button
          variant="outline"
          onClick={handleResetToDefault}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          {t('reset_to_default')}
        </Button>
      </motion.div>

      {/* Tabs for document types */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DocumentType)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 glass">
          <TabsTrigger value="invoice" className="gap-2">
            <FileText className="w-4 h-4" />
            {t('sales_invoice')}
          </TabsTrigger>
          <TabsTrigger value="credit-note" className="gap-2">
            <FileX2 className="w-4 h-4" />
            {t('sales_credit_note')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoice" className="mt-6">
          <PdfSettingsContent
            documentType="invoice"
            components={invoiceComponents}
            onToggleComponent={handleToggleComponent}
            showAIAgent={showAIAgent}
            setShowAIAgent={setShowAIAgent}
            previewKey={previewKey}
            enabledCount={enabledCount}
            totalCount={totalCount}
            t={t}
            isRTL={isRTL}
          />
        </TabsContent>

        <TabsContent value="credit-note" className="mt-6">
          <PdfSettingsContent
            documentType="credit-note"
            components={creditNoteComponents}
            onToggleComponent={handleToggleComponent}
            showAIAgent={showAIAgent}
            setShowAIAgent={setShowAIAgent}
            previewKey={previewKey}
            enabledCount={enabledCount}
            totalCount={totalCount}
            t={t}
            isRTL={isRTL}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface PdfSettingsContentProps {
  documentType: DocumentType;
  components: PdfComponent[];
  onToggleComponent: (id: string, enabled: boolean) => void;
  showAIAgent: boolean;
  setShowAIAgent: (show: boolean) => void;
  previewKey: number;
  enabledCount: number;
  totalCount: number;
  t: (key: string) => string;
  isRTL: boolean;
}

const PdfSettingsContent: React.FC<PdfSettingsContentProps> = ({
  documentType,
  components,
  onToggleComponent,
  showAIAgent,
  setShowAIAgent,
  previewKey,
  enabledCount,
  totalCount,
  t,
  isRTL,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left column: Preview */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">{t('pdf_preview')}</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                {t('live_preview')}
              </Badge>
            </div>
            <CardDescription>{t('pdf_preview_description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PdfTemplatePreview 
              documentType={documentType} 
              components={components}
              key={previewKey}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Right column: Components + AI Agent */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        {/* Components list */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">{t('pdf_components')}</CardTitle>
              </div>
              <Badge variant="secondary">
                {enabledCount}/{totalCount} {t('enabled')}
              </Badge>
            </div>
            <CardDescription>{t('pdf_components_description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PdfComponentsList 
              components={components} 
              onToggle={onToggleComponent}
            />
          </CardContent>
        </Card>

        {/* AI Agent toggle */}
        <Card className="glass border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">{t('pdf_ai_agent')}</CardTitle>
              </div>
              <Button
                variant={showAIAgent ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAIAgent(!showAIAgent)}
                className="gap-2"
              >
                {showAIAgent ? <X className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {showAIAgent ? t('close') : t('open')}
              </Button>
            </div>
            <CardDescription>{t('pdf_ai_agent_description')}</CardDescription>
          </CardHeader>
          {showAIAgent && (
            <CardContent>
              <PdfAIAgent 
                documentType={documentType} 
                components={components}
                onToggleComponent={onToggleComponent}
              />
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default PdfSettings;
